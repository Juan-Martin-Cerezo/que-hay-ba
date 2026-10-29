import { parseArtDateTime } from "../normalise";
import type { RawEvent } from "../types";

interface LivepassItem {
  event_id?: number | string;
  id?: string;
  title?: string;
  location?: string | null;
  date?: string | null;
  img?: string | null;
  url?: string | null;
  price?: number | string | null;
  currency?: string | null;
  category?: string | null;
}

const MONTHS_ES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function parseLivepassDate(
  dateText?: string | null,
  slug?: string | null,
  now = new Date()
): Date | null {
  // 1. Check slug for explicit ISO date e.g. "...-2026-10-30-20-45-00-0300" or "...-2026-10-28"
  if (slug) {
    const isoFull = /(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-\d{2}-0300/.exec(slug);
    if (isoFull) {
      return parseArtDateTime(isoFull[1], `${isoFull[2]}:${isoFull[3]}`);
    }
    const isoDay = /(\d{4}-\d{2}-\d{2})$/.exec(slug);
    if (isoDay) {
      const timeMatch = /(\d{1,2}:\d{2})/.exec(dateText ?? "");
      return parseArtDateTime(isoDay[1], timeMatch ? timeMatch[1] : "21:00");
    }
  }

  if (!dateText) return null;
  // Format: "Miércoles 28 de Octubre 20:45"
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?(?:\s+(\d{1,2}:\d{2}))?/i.exec(
    dateText
  );
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const monthKey = m[2]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const month = MONTHS_ES[monthKey];
  if (!month) return null;

  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;
  let year = m[3] ? Number(m[3]) : curYear;
  if (!m[3] && Number(month) < curMonth - 1) {
    year = curYear + 1;
  }
  const timeStr = m[4] && m[4] !== "00:00" ? m[4] : "21:00";
  return parseArtDateTime(`${year}-${month}-${day}`, timeStr);
}

function extractVenueName(title: string, location: string): string {
  const inTitle = /\ben\s+([^|-]+)$/i.exec(title.trim());
  if (inTitle && inTitle[1].trim().length >= 3 && inTitle[1].trim().length <= 45) {
    return inTitle[1].trim();
  }
  const firstPart = location.split(",")[0]?.trim();
  return firstPart || "Buenos Aires";
}

export async function fetchLivepassEvents(): Promise<RawEvent[]> {
  const res = await fetch("https://livepass.com.ar/events/search.json?q=&searching=true", {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];

  const payload = (await res.json()) as { results?: LivepassItem[] };
  const items = payload.results ?? [];
  const now = Date.now();
  const out: RawEvent[] = [];

  for (const item of items) {
    const title = (item.title ?? "").trim();
    const location = (item.location ?? "").trim();
    if (!title || !location || !item.url) continue;

    // Filter out non-event entries (merchandising, test items) and non-CABA cities.
    if (/\b(merchandising|membres[ií]a|prueba|abono|estacionamiento|voucher)\b/i.test(title))
      continue;
    if (
      /\b(la plata|san miguel|quilmes|temperley|haedo|ituzaing[oó]|mar del plata|rosario|c[oó]rdoba|mendoza| Pilar|escobar|lomas de zamora|lan[uú]s|avellaneda|mor[oó]n|ramos mej[ií]a|san isidro|vicente l[oó]pez|tigre)\b/i.test(
        `${title} ${location}`
      )
    ) {
      continue;
    }
    if (
      !/\b(buenos aires|caba|capital federal|palermo|colegiales|devoto|chacarita|recoleta|centro)\b/i.test(
        location
      )
    ) {
      continue;
    }

    const startsAt = parseLivepassDate(item.date, item.id);
    if (!startsAt || startsAt.getTime() < now - 4 * 3600_000) continue;

    const rawPrice = item.price != null ? Math.round(Number(item.price)) : null;
    const validPrice =
      rawPrice != null && Number.isFinite(rawPrice) && rawPrice >= 500 ? rawPrice : null;

    const venueName = extractVenueName(title, location);
    const streetAddress = location
      .replace(/,?\s*(ciudad aut[oó]noma de )?buenos aires.*$/i, "")
      .trim();

    out.push({
      source: "livepass",
      sourceId: String(item.event_id ?? item.id ?? title),
      title,
      description: `Show en vivo en ${venueName} (${streetAddress}). Entradas oficiales por Livepass.`,
      imageUrl: item.img || null,
      url: item.url,
      ticketsUrl: item.url,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 150 * 60_000),
      venueName,
      address: streetAddress || null,
      barrio: null,
      lat: null,
      lng: null,
      isFree: false,
      priceMin: validPrice,
      priceMax: validPrice,
      sourceCategories: ["Música", "Recital", item.category ?? ""].filter(Boolean),
    });
  }

  return out;
}
