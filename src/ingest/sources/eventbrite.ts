import { isInsideCaba, parseArtDateTime } from "../normalise";
import type { RawEvent } from "../types";

interface EbVenue {
  name?: string;
  address?: {
    address_1?: string;
    city?: string;
    region?: string;
    latitude?: string | number;
    longitude?: string | number;
    localized_address_display?: string;
  };
}

interface EbTicketPrice {
  currency?: string;
  major_value?: string;
  value?: number;
}

interface EbEvent {
  id: string;
  eid?: string;
  name?: string;
  summary?: string | null;
  url?: string;
  tickets_url?: string | null;
  is_online_event?: boolean;
  is_cancelled?: boolean | null;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  primary_venue?: EbVenue | null;
  image?: {
    url?: string;
    image_sizes?: { large?: string; medium?: string; small?: string };
  } | null;
  tags?: Array<{ display_name?: string; localized?: { display_name?: string } }>;
  ticket_availability?: {
    is_free?: boolean;
    minimum_ticket_price?: EbTicketPrice | null;
    maximum_ticket_price?: EbTicketPrice | null;
  } | null;
}

const DISCOVERY_URLS = [
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/events/",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/all-events/?page=1",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/all-events/?page=2",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/all-events/?page=3",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/all-events/?page=4",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/free--events/?page=1",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/free--events/?page=2",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/music--events/?page=1",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/food-and-drink--events/?page=1",
  "https://www.eventbrite.com.ar/d/argentina--buenos-aires/arts--events/?page=1",
];

function extractServerData(html: string): Record<string, unknown> | null {
  const marker = "window.__SERVER_DATA__ = ";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;
  const endMarker = html.indexOf("window.__REACT_QUERY_STATE__", start);
  const endScript = html.indexOf("</script>", start);
  const stop = endMarker !== -1 && endMarker < endScript ? endMarker : endScript;
  if (stop === -1) return null;
  let raw = html.slice(start, stop).trim();
  while (raw.endsWith(";")) raw = raw.slice(0, -1).trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchEventbriteEvents(): Promise<RawEvent[]> {
  const byId = new Map<string, { ev: EbEvent; forcedFree: boolean }>();

  for (const pageUrl of DISCOVERY_URLS) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "es-AR,es;q=0.9",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const data = extractServerData(html);
      if (!data) continue;

      const isFreeListing = pageUrl.includes("/free--events/");
      const collected: EbEvent[] = [];

      const buckets = data.buckets as Array<{ events?: EbEvent[] }> | undefined;
      for (const b of buckets ?? []) {
        for (const e of b.events ?? []) collected.push(e);
      }
      const searchData = data.search_data as { events?: { results?: EbEvent[] } } | undefined;
      for (const e of searchData?.events?.results ?? []) {
        collected.push(e);
      }

      for (const e of collected) {
        if (!e?.id || e.is_online_event || e.is_cancelled) continue;
        const prev = byId.get(e.id);
        byId.set(e.id, { ev: prev?.ev ?? e, forcedFree: Boolean(prev?.forcedFree || isFreeListing) });
      }
    } catch {
      // Continue with remaining pages if one times out.
    }
  }

  // Batch-enrich with ticket_availability + summary via Eventbrite's public destination API.
  const ids = [...byId.keys()];
  const enriched = new Map<string, EbEvent>();
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    try {
      const apiUrl = `https://www.eventbrite.com.ar/api/v3/destination/events/?event_ids=${chunk.join(
        ","
      )}&expand=ticket_availability,primary_venue,image&page_size=50`;
      const res = await fetch(apiUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const payload = (await res.json()) as { events?: EbEvent[] };
        for (const ev of payload.events ?? []) {
          if (ev.id) enriched.set(ev.id, ev);
        }
      }
    } catch {
      // Non-fatal: fall back to page-embedded data.
    }
  }

  const out: RawEvent[] = [];
  for (const [id, { ev: base, forcedFree }] of byId.entries()) {
    const rich = enriched.get(id);
    const ev: EbEvent = { ...base, ...rich, primary_venue: rich?.primary_venue ?? base.primary_venue };
    const title = (ev.name ?? "").trim();
    if (!title || !ev.start_date || !ev.url) continue;

    const startsAt = parseArtDateTime(ev.start_date, ev.start_time ?? "20:00");
    if (!startsAt) continue;
    const endsAt = ev.end_date ? parseArtDateTime(ev.end_date, ev.end_time ?? "23:00") : null;

    const addr = ev.primary_venue?.address;
    const lat = addr?.latitude != null ? Number(addr.latitude) : null;
    const lng = addr?.longitude != null ? Number(addr.longitude) : null;
    if (!isInsideCaba(lat, lng)) continue;

    const ta = ev.ticket_availability;
    const isFree = Boolean(forcedFree || ta?.is_free);
    let priceMin: number | null = isFree ? 0 : null;
    let priceMax: number | null = isFree ? 0 : null;
    if (!isFree && ta?.minimum_ticket_price?.currency === "ARS" && ta.minimum_ticket_price.major_value) {
      const min = Math.round(Number(ta.minimum_ticket_price.major_value));
      const max = ta.maximum_ticket_price?.major_value
        ? Math.round(Number(ta.maximum_ticket_price.major_value))
        : min;
      if (Number.isFinite(min) && min > 0) {
        priceMin = min;
        priceMax = Number.isFinite(max) && max >= min ? max : min;
      } else if (min === 0) {
        priceMin = 0;
        priceMax = 0;
      }
    }

    const tags = (ev.tags ?? [])
      .map((t) => t.localized?.display_name || t.display_name || "")
      .filter(Boolean);

    out.push({
      source: "eventbrite",
      sourceId: id,
      title,
      description: ev.summary?.trim() || null,
      imageUrl:
        ev.image?.image_sizes?.large ||
        ev.image?.image_sizes?.medium ||
        ev.image?.url ||
        base.image?.image_sizes?.medium ||
        null,
      url: ev.url,
      ticketsUrl: ev.url,
      startsAt,
      endsAt,
      venueName: (ev.primary_venue?.name || addr?.address_1 || "Buenos Aires").trim(),
      address: addr?.address_1?.trim() || addr?.localized_address_display || null,
      barrio: null,
      lat,
      lng,
      isFree: isFree || priceMin === 0,
      priceMin,
      priceMax,
      sourceCategories: tags,
    });
  }

  return out;
}
