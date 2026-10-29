import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { formatPriceLabel } from "@/ingest/normalise";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number.parseInt(id, 10);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const db = sql();
  const rows = await db<
    {
      id: number;
      group_key: string;
      title: string;
      description: string | null;
      image_url: string | null;
      url: string;
      tickets_url: string | null;
      source: string;
      sources: Array<{ source: string; url: string }>;
      category: string;
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
    }[]
  >`
    select
      e.id, e.group_key, e.title, e.description, e.image_url, e.url, e.tickets_url,
      e.source, e.sources, e.category, e.is_free, e.price_min, e.price_max,
      e.starts_at, e.ends_at,
      v.name as venue_name, v.address, v.barrio, v.lat, v.lng
    from events e
    join venues v on v.id = e.venue_id
    where e.id = ${eventId}
    limit 1
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ev = rows[0];

  const scheduleRows = await db<{ id: number; starts_at: string }[]>`
    select id, starts_at
    from events
    where group_key = ${ev.group_key}
      and starts_at >= now() - interval '2 hours'
    order by starts_at asc
    limit 10
  `;

  return NextResponse.json(
    {
      id: ev.id,
      groupKey: ev.group_key,
      title: ev.title,
      description: ev.description,
      imageUrl: ev.image_url,
      url: ev.url,
      ticketsUrl: ev.tickets_url || ev.url,
      source: ev.source,
      sources: ev.sources,
      category: ev.category,
      isFree: ev.is_free,
      priceMin: ev.price_min,
      priceMax: ev.price_max,
      priceLabel: formatPriceLabel(ev.is_free, ev.price_min, ev.price_max),
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      venueName: ev.venue_name,
      address: ev.address,
      barrio: ev.barrio,
      lat: ev.lat,
      lng: ev.lng,
      upcomingSchedule: scheduleRows.map((s) => ({ id: s.id, startsAt: s.starts_at })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    }
  );
}
