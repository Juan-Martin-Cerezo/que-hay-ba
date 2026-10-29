import { parseArtDateTime, parsePrice, stripHtml } from "../normalise";
import type { RawEvent } from "../types";

const BASE = "https://www.cultura.gob.ar";
const UA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0";

const LISTING_URLS = [
  `${BASE}/agenda/`,
  `${BASE}/agenda/filtro/?categoria=musica`,
  `${BASE}/agenda/filtro/?categoria=teatro`,
  `${BASE}/agenda/filtro/?categoria=arte`,
  `${BASE}/agenda/filtro/?categoria=museos`,
  `${BASE}/agenda/filtro/?categoria=cine`,
  `${BASE}/agenda/filtro/?categoria=danza`,
  `${BASE}/agenda/filtro/?categoria=letras`,
];

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

interface CardCandidate {
  path: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  dateHint: string;
  tags: string[];
}

function parseSpanishDate(text: string, now = new Date()): Date | null {
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?/i.exec(text);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const monthKey = m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const month = MONTHS_ES[monthKey];
  if (!month) return null;
  const year = m[3] ? Number(m[3]) : now.getUTCFullYear();
  return parseArtDateTime(`${year}-${month}-${day}`, "15:00");
}

export async function fetchCulturaNacionEvents(): Promise<RawEvent[]> {
  const byPath = new Map<string, CardCandidate>();

  await Promise.all(
    LISTING_URLS.map(async (url) => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "text/html" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const html = await res.text();
        const blocks = html.split('<div class="post caja">').slice(1);
        for (const b of blocks) {
          const geo = b.match(/<div class="geo">([\s\S]*?)<\/div>/i)?.[1] ?? "";
          if (!/\bCABA\b/i.test(stripHtml(geo))) continue;

          const linkMatch = b.match(/<h2 class="titulo">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/i);
          if (!linkMatch) continue;
          const path = linkMatch[1].trim();
          const title = stripHtml(linkMatch[2]).trim();
          if (!path || !title) continue;

          const dateHint = stripHtml(b.match(/<small[^>]*>([\s\S]*?)<\/small>/i)?.[1] ?? "");
          const summary = stripHtml(b.match(/<div class="bajada">([\s\S]*?)<\/div>/i)?.[1] ?? "") || null;
          const imgRaw = b.match(/data-original="([^"]+)"/i)?.[1] ?? null;
          const imageUrl = imgRaw ? (imgRaw.startsWith("http") ? imgRaw : `${BASE}${imgRaw}`) : null;
          const tags = [...b.matchAll(/<div class="tag sector[^"]*"><span>([\s\S]*?)<\/span><\/div>/gi)].map((m) =>
            stripHtml(m[1]).trim()
          );

          if (!byPath.has(path)) {
            byPath.set(path, { path, title, summary, imageUrl, dateHint, tags });
          }
        }
      } catch {
        // Ignore single page failure
      }
    })
  );

  const candidates = [...byPath.values()].slice(0, 45);
  const out: RawEvent[] = [];
  const now = new Date();

  const BATCH = 6;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (c) => {
        try {
          const fullUrl = c.path.startsWith("http") ? c.path : `${BASE}${c.path}`;
          const res = await fetch(fullUrl, {
            headers: { "User-Agent": UA, Accept: "text/html" },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return;
          const html = await res.text();

          // Extract ¿Dónde? paragraph (HTML uses entities like &iquest;D&oacute;nde?)
          const dondeBlock =
            html.match(/<h3>[^<]*D(?:&oacute;|ó|o)nde\??[^<]*<\/h3>\s*<p>([\s\S]*?)<\/p>/i)?.[1] ?? "";
          const dondeText = stripHtml(dondeBlock).replace(/\.\s*$/, "").trim();
          const parts = dondeText.split(",").map((s) => s.trim()).filter(Boolean);
          const venueName = parts[0] || "Casa Nacional del Bicentenario";
          const address =
            parts
              .slice(1)
              .filter((p) => !/^caba$/i.test(p))
              .join(", ") || "Riobamba 985";

          // Extract full description
          const contentWrap = html.match(/<div class="content-wrap">([\s\S]*?)<footer>/i)?.[1] ?? "";
          const description = stripHtml(contentWrap).slice(0, 1000) || c.summary;

          // Extract sidebar schedule + free confirmation
          const panelBlock = html.match(/<article class="panel panel-neutro">([\s\S]*?)<\/article>/i)?.[1] ?? "";
          const panelText = stripHtml(panelBlock);
          const price = parsePrice(
            `${panelText}\n${description ?? ""}`,
            /\b(actividad gratuita|entrada libre y gratuita|acceso gratuito|sin costo)\b/i.test(panelText) ? true : null
          );

          // Determine upcoming date: if ongoing ("Hasta el..."), anchor to today 15:00 ART if end date is >= today.
          const parsedEnd = parseSpanishDate(c.dateHint, now);
          if (parsedEnd && parsedEnd.getTime() < now.getTime() - 24 * 3600_000) return;

          const todayArt = new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
          let startsAt = new Date(`${todayArt}T15:00:00-03:00`);
          if (!/hasta\s+el/i.test(c.dateHint) && parsedEnd && parsedEnd.getTime() > now.getTime()) {
            startsAt = parsedEnd;
          }

          const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ?? c.imageUrl;

          out.push({
            source: "cultura_nacion",
            sourceId: c.path.replace(/^\/+|\/+$/g, ""),
            title: c.title,
            description,
            imageUrl: ogImage,
            url: fullUrl,
            ticketsUrl: fullUrl,
            startsAt,
            endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
            venueName,
            address,
            barrio: null,
            lat: null,
            lng: null,
            isFree: price.isFree,
            priceMin: price.priceMin,
            priceMax: price.priceMax,
            sourceCategories: c.tags.length ? c.tags : ["Cultura"],
          });
        } catch {
          // Non-fatal
        }
      })
    );
  }

  return out;
}
