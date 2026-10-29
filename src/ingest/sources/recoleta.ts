import { parseArtDateTime, stripHtml } from "../normalise";
import type { RawEvent } from "../types";

const BASE = "http://www.centroculturalrecoleta.org";
const RECOLETA_COORDS = {
  venueName: "Centro Cultural Recoleta",
  address: "Junín 1930",
  barrio: "Recoleta",
  lat: -34.586724,
  lng: -58.391792,
};

function parseRecoletaDates(dateStr: string, now = new Date()): Date[] {
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1;
  const minMs = now.getTime() - 4 * 3600_000;

  // Extract time like "16 h", "19.30 h", "20:00"
  const timeMatch = /(\d{1,2})(?:[:.](\d{2}))?\s*h/i.exec(dateStr);
  const hh = timeMatch ? timeMatch[1].padStart(2, "0") : "17";
  const mm = timeMatch && timeMatch[2] ? timeMatch[2] : "00";
  const timeFormatted = `${hh}:${mm}`;

  const ddMm = [...dateStr.matchAll(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/g)];

  if (/hasta\s+el/i.test(dateStr) && ddMm.length > 0) {
    const last = ddMm[ddMm.length - 1];
    const d = last[1].padStart(2, "0");
    const m = last[2].padStart(2, "0");
    let y = last[3] ? (last[3].length === 2 ? Number(`20${last[3]}`) : Number(last[3])) : curYear;
    if (!last[3] && Number(m) < curMonth - 1) y = curYear + 1;
    const endDt = parseArtDateTime(`${y}-${m}-${d}`, "21:00");
    if (endDt && endDt.getTime() >= minMs) {
      const todayArt = new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
      const todaySlot = parseArtDateTime(todayArt, timeFormatted);
      return todaySlot ? [todaySlot] : [];
    }
    return [];
  }

  const results: Date[] = [];
  for (const m of ddMm) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    let year = m[3] ? (m[3].length === 2 ? Number(`20${m[3]}`) : Number(m[3])) : curYear;
    if (!m[3] && Number(month) < curMonth - 1) year = curYear + 1;
    const dt = parseArtDateTime(`${year}-${month}-${day}`, timeFormatted);
    if (dt && dt.getTime() >= minMs) {
      results.push(dt);
    }
  }

  if (results.length === 0 && !ddMm.length) {
    // Ongoing permanent room/exhibition without end date
    const todayArt = new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
    const todaySlot = parseArtDateTime(todayArt, "15:00");
    if (todaySlot) results.push(todaySlot);
  }

  return results.slice(0, 3);
}

export async function fetchRecoletaEvents(): Promise<RawEvent[]> {
  const res = await fetch(`${BASE}/agenda`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const html = await res.text();

  const boxes = [...html.matchAll(/<li class=['"]box event[^'"]*['"][^>]*>([\s\S]*?)<\/li>/gi)];
  const out: RawEvent[] = [];
  const now = new Date();

  for (const match of boxes) {
    const block = match[1];
    const titleRaw =
      block.match(/<h3>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/h3>/i)?.[1] ??
      block.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1] ??
      "";
    const title = stripHtml(titleRaw).trim();
    if (!title || /\bconvocatoria\b/i.test(title)) continue;

    const href = block
      .match(/<a[^>]+class="[^"]*see-more-button[^"]*"[^>]+href="([^"]+)"/i)?.[1]
      ?.trim();
    if (!href) continue;

    const tag = stripHtml(block.match(/<a[^>]+class="link1"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "")
      .replace(/^#/, "")
      .trim();
    const dateText = stripHtml(
      block.match(/<div class=['"]date['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""
    ).trim();
    const imgSrc = block.match(/<img[^>]+src="([^"]+)"/i)?.[1]?.trim() ?? null;
    const imageUrl = imgSrc ? (imgSrc.startsWith("http") ? imgSrc : `${BASE}${imgSrc}`) : null;
    const fullUrl = href.startsWith("http") ? href : `${BASE}${href}`;

    const dates = parseRecoletaDates(dateText, now);
    for (const startsAt of dates) {
      out.push({
        source: "recoleta",
        sourceId: `${href.replace(/^\/agenda\/?/, "")}:${startsAt.toISOString().slice(0, 13)}`,
        title,
        description: `${tag ? `${tag} en el ` : ""}Centro Cultural Recoleta (${dateText || "Entrada libre y gratuita"}).`,
        imageUrl,
        url: fullUrl,
        ticketsUrl: fullUrl,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
        venueName: RECOLETA_COORDS.venueName,
        address: RECOLETA_COORDS.address,
        barrio: RECOLETA_COORDS.barrio,
        lat: RECOLETA_COORDS.lat,
        lng: RECOLETA_COORDS.lng,
        isFree: true,
        priceMin: 0,
        priceMax: 0,
        sourceCategories: [tag || "Arte y Cultura", "Centro Cultural Recoleta"],
      });
    }
  }

  return out;
}
