import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { CATEGORY_IDS, type CategoryId } from "@/lib/domain";
import { computeTimeWindow, formatPriceLabel } from "@/ingest/normalise";

export interface EventRow {
  id: number;
  group_key: string;
  title: string;
  description: string | null;
  image_url: string | null;
  url: string;
  tickets_url: string | null;
  source: string;
  sources: Array<{ source: string; url: string }>;
  category: CategoryId;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  starts_at: string;
  ends_at: string | null;
  venue_name: string;
  address: string | null;
  barrio: string | null;
  lat: number;
  lng: number;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const price = sp.get("price") ?? "";
  const catParam = sp.get("cat") ?? "";
  const when = sp.get("when") ?? "";
  const q = (sp.get("q") ?? "").trim();

  const categories = catParam
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is CategoryId => CATEGORY_IDS.includes(c as CategoryId));

  const { from, to, liveNow } = computeTimeWindow(when);
  const db = sql();

  const rows = await db<EventRow[]>`
    select distinct on (e.group_key)
      e.id,
      e.group_key,
      e.title,
      left(e.description, 260) as description,
      e.image_url,
      e.url,
      e.tickets_url,
      e.source,
      e.sources,
      e.category,
      e.is_free,
      e.price_min,
      e.price_max,
      e.starts_at,
      e.ends_at,
      v.name as venue_name,
      v.address,
      v.barrio,
      v.lat,
      v.lng
    from events e
    join venues v on v.id = e.venue_id
    where e.starts_at >= ${from.toISOString()}
      and e.starts_at <= ${to.toISOString()}
      ${
        liveNow
          ? db`and e.starts_at <= now() + interval '30 minutes' and coalesce(e.ends_at, e.starts_at + interval '2 hours') >= now()`
          : db``
      }
      ${categories.length > 0 ? db`and e.category in ${db(categories)}` : db``}
      ${
        price === "free"
          ? db`and e.is_free = true`
          : price === "eco"
            ? db`and (e.is_free = true or (e.price_min is not null and e.price_min <= 10000))`
            : price === "mod"
              ? db`and e.is_free = false and e.price_min is not null and e.price_min > 10000 and e.price_min <= 30000`
              : price === "premium"
                ? db`and e.is_free = false and e.price_min is not null and e.price_min > 30000`
                : db``
      }
      ${
        q
          ? db`and (
              e.title ilike ${"%" + q + "%"}
              or v.name ilike ${"%" + q + "%"}
              or coalesce(v.barrio, '') ilike ${"%" + q + "%"}
              or coalesce(e.description, '') ilike ${"%" + q + "%"}
            )`
          : db``
      }
    order by e.group_key, e.starts_at asc
    limit 1200
  `;

  // Sort chronologically by starts_at for the sidebar / list order.
  rows.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  // Slight deterministic jitter (~18m) for multiple events sharing the exact same venue coordinates so pins remain clickable at max zoom.
  const seenCoords = new Map<string, number>();
  const features = rows.map((r) => {
    const coordKey = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
    const idx = seenCoords.get(coordKey) ?? 0;
    seenCoords.set(coordKey, idx + 1);
    const angle = idx * 2.399963229728653; // golden angle
    const radius = idx === 0 ? 0 : Math.min(0.00028, 0.00009 * Math.sqrt(idx));
    const lng = r.lng + radius * Math.cos(angle);
    const lat = r.lat + radius * Math.sin(angle);

    return {
      type: "Feature" as const,
      id: r.id,
      geometry: {
        type: "Point" as const,
        coordinates: [lng, lat] as [number, number],
      },
      properties: {
        id: r.id,
        groupKey: r.group_key,
        title: r.title,
        description: r.description,
        imageUrl: r.image_url,
        url: r.url,
        ticketsUrl: r.tickets_url || r.url,
        source: r.source,
        sources: r.sources,
        category: r.category,
        isFree: r.is_free,
        priceMin: r.price_min,
        priceMax: r.price_max,
        priceLabel: formatPriceLabel(r.is_free, r.price_min, r.price_max),
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        venueName: r.venue_name,
        address: r.address,
        barrio: r.barrio,
        lat: r.lat,
        lng: r.lng,
      },
    };
  });

  return NextResponse.json(
    {
      type: "FeatureCollection",
      total: features.length,
      window: { from: from.toISOString(), to: to.toISOString() },
      features,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600",
      },
    }
  );
}
