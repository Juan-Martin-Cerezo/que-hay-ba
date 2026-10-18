import { sql } from "@/lib/db";
import type { CategoryId } from "@/lib/domain";
import { resolveCoords } from "./geocode";
import { classifyEvent, makeDedupKey, makeGroupKey, makeVenueKey, parsePrice } from "./normalise";
import { fetchAlternativaEvents } from "./sources/alternativa";
import { fetchEventbriteEvents } from "./sources/eventbrite";
import { fetchGcbaEvents } from "./sources/gcba";
import type { RawEvent, SourceId } from "./types";
import { SEED_VENUES } from "./venues-seed";

export async function seedVenues(): Promise<number> {
  const db = sql();
  let count = 0;
  for (const v of SEED_VENUES) {
    const key = makeVenueKey(v.name, v.address);
    await db`
      insert into venues (key, name, address, barrio, lat, lng)
      values (${key}, ${v.name}, ${v.address}, ${v.barrio}, ${v.lat}, ${v.lng})
      on conflict (key) do update set
        name = excluded.name,
        address = coalesce(venues.address, excluded.address),
        barrio = coalesce(venues.barrio, excluded.barrio),
        lat = excluded.lat,
        lng = excluded.lng
    `;
    count++;
  }
  return count;
}

const DEFAULT_CATEGORY_BY_SOURCE: Record<SourceId, CategoryId> = {
  alternativa: "teatro",
  eventbrite: "talleres",
  gcba: "arte",
};

export interface IngestSummary {
  source: SourceId;
  fetched: number;
  upserted: number;
  pruned: number;
  durationMs: number;
}

export async function ingestSource(source: SourceId, opts?: { enrichLimit?: number }): Promise<IngestSummary> {
  const db = sql();
  const started = Date.now();

  const [runRow] = await db<{ id: number }[]>`
    insert into ingest_runs (source, started_at, ok)
    values (${source}, now(), false)
    returning id
  `;
  const runId = runRow.id;

  try {
    let rawEvents: RawEvent[];
    if (source === "gcba") rawEvents = await fetchGcbaEvents();
    else if (source === "eventbrite") rawEvents = await fetchEventbriteEvents();
    else rawEvents = await fetchAlternativaEvents(opts?.enrichLimit ?? 35);

    // Preload known venues into memory to minimise round-trips.
    const existingVenues = await db<{ id: number; key: string; lat: number; lng: number }[]>`
      select id, key, lat, lng from venues
    `;
    const venueMap = new Map(existingVenues.map((v) => [v.key, v]));

    let upserted = 0;
    for (const raw of rawEvents) {
      const venueKey = makeVenueKey(raw.venueName, raw.address);
      let venue = venueMap.get(venueKey);

      if (!venue) {
        const coords = await resolveCoords(raw.venueName, raw.address, raw.lat, raw.lng);
        if (!coords) continue;

        const [inserted] = await db<{ id: number; key: string; lat: number; lng: number }[]>`
          insert into venues (key, name, address, barrio, lat, lng)
          values (${venueKey}, ${raw.venueName}, ${raw.address ?? null}, ${raw.barrio ?? null}, ${coords.lat}, ${coords.lng})
          on conflict (key) do update set
            address = coalesce(venues.address, excluded.address),
            barrio = coalesce(venues.barrio, excluded.barrio)
          returning id, key, lat, lng
        `;
        venue = inserted;
        venueMap.set(venueKey, venue);
      }

      const price = parsePrice(raw.priceText ?? raw.description, raw.isFree, raw.priceMin, raw.priceMax);
      const category = classifyEvent(
        raw.title,
        raw.description,
        raw.sourceCategories,
        DEFAULT_CATEGORY_BY_SOURCE[source]
      );
      const dedupKey = makeDedupKey(raw.title, venueKey, raw.startsAt);
      const groupKey = makeGroupKey(raw.title, venueKey);
      const sourceEntry = JSON.stringify([{ source: raw.source, url: raw.url }]);

      await db`
        insert into events (
          dedup_key, group_key, title, description, image_url, url, tickets_url,
          source, source_id, sources, category, is_free, price_min, price_max,
          starts_at, ends_at, venue_id, last_seen_at
        ) values (
          ${dedupKey}, ${groupKey}, ${raw.title}, ${raw.description ?? null}, ${raw.imageUrl ?? null},
          ${raw.url}, ${raw.ticketsUrl ?? raw.url}, ${raw.source}, ${raw.sourceId},
          ${sourceEntry}::jsonb, ${category}, ${price.isFree}, ${price.priceMin}, ${price.priceMax},
          ${raw.startsAt.toISOString()}, ${raw.endsAt ? raw.endsAt.toISOString() : null},
          ${venue.id}, now()
        )
        on conflict (dedup_key) do update set
          description = coalesce(excluded.description, events.description),
          image_url   = coalesce(excluded.image_url, events.image_url),
          tickets_url = coalesce(excluded.tickets_url, events.tickets_url),
          is_free     = events.is_free or excluded.is_free,
          price_min   = coalesce(excluded.price_min, events.price_min),
          price_max   = coalesce(excluded.price_max, events.price_max),
          sources     = (
            select jsonb_agg(distinct elem)
            from jsonb_array_elements(events.sources || excluded.sources) as elem
          ),
          last_seen_at = now()
      `;
      upserted++;
    }

    // Prune events that ended more than 2 days ago.
    const prunedRows = await db<{ id: number }[]>`
      delete from events
      where starts_at < now() - interval '2 days'
      returning id
    `;

    await db`
      update ingest_runs
      set finished_at = now(), ok = true, fetched = ${rawEvents.length}, upserted = ${upserted}, pruned = ${prunedRows.length}
      where id = ${runId}
    `;

    return {
      source,
      fetched: rawEvents.length,
      upserted,
      pruned: prunedRows.length,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db`
      update ingest_runs
      set finished_at = now(), ok = false, error = ${message.slice(0, 500)}
      where id = ${runId}
    `;
    throw err;
  }
}
