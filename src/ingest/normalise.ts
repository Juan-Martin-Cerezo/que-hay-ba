import { createHash } from "node:crypto";
import { ART_OFFSET_MIN, type CategoryId } from "@/lib/domain";

// Strict CABA bounding box (Gral. Paz + Riachuelo + Río de la Plata).
export const CABA_BBOX = {
  minLat: -34.706,
  maxLat: -34.526,
  minLng: -58.532,
  maxLng: -58.334,
} as const;

export function isInsideCaba(
  lat: number | null | undefined,
  lng: number | null | undefined
): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= CABA_BBOX.minLat &&
    lat <= CABA_BBOX.maxLat &&
    lng >= CABA_BBOX.minLng &&
    lng <= CABA_BBOX.maxLng
  );
}

export function normText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&ldquo;|&rdquo;|&laquo;|&raquo;/gi, '"')
    .replace(/&iquest;/gi, "¿")
    .replace(/&iexcl;/gi, "¡")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&uuml;/gi, "ü")
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 31 ? String.fromCodePoint(code) : " ";
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export interface ParsedPrice {
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
}

const PAID_CONTRADICTION_RE =
  /\b(arancelad[oa]s?|con costo|con entrada paga|venta de entradas|localidades en venta|adquiri tu entrada|comprar entrada|entradas en boleteria|consumicion minima|consumicion obligatoria|derecho a show|cubierto artistico)\b/;

const EXPLICIT_FREE_RE =
  /\b(entrada libre y gratuita|libre y gratuit[oa]|entrada gratuita|entrada libre|actividad gratuita|acceso libre y gratuito|acceso gratuito|sin cargo|sin costo|espectaculo gratuito|paseo gratuito|recorrido gratuito|ciclo gratuito|visita gratuita)\b/;

// ponytail: conservative price parser — never mark free unless explicitly verified without paid contradictions
export function parsePrice(
  text: string | null | undefined,
  explicitFree?: boolean | null,
  explicitMin?: number | null,
  explicitMax?: number | null
): ParsedPrice {
  // 1. Explicit numeric price takes highest priority when positive.
  if (typeof explicitMin === "number" && Number.isFinite(explicitMin) && explicitMin > 0) {
    const min = Math.round(explicitMin);
    const max =
      typeof explicitMax === "number" && Number.isFinite(explicitMax)
        ? Math.round(explicitMax)
        : min;
    return { isFree: false, priceMin: min, priceMax: Math.max(min, max) };
  }

  const raw = (text ?? "").replace(
    /Este es un espacio de difusi[oó]n abierto y gratuito[\s\S]*$/i,
    ""
  );
  const n = normText(raw);

  // 2. Extract ARS amounts such as "$ 10.000,00", "$8.000 / $12.000", "$15000", "ARS 25.000".
  const matches = [
    ...raw.matchAll(/(?:\$|ars)\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]{3,7})(?:,[0-9]{1,2})?/gi),
  ];
  const values: number[] = [];
  for (const m of matches) {
    const digits = m[1].replace(/[.\s]/g, "");
    const val = Number.parseInt(digits, 10);
    if (Number.isFinite(val) && val >= 500 && val <= 2_000_000) {
      values.push(val);
    }
  }
  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { isFree: false, priceMin: min, priceMax: max };
  }

  // 3. If explicitly marked NOT free, or text mentions paid/arancelado/gorra, never classify as free.
  if (
    explicitFree === false ||
    PAID_CONTRADICTION_RE.test(n) ||
    /\b(a la gorra|gorra consciente|contribuci\w* voluntaria|bono contribuci\w*)\b/.test(n)
  ) {
    return { isFree: false, priceMin: null, priceMax: null };
  }

  // 4. Only mark free when explicitly confirmed by source metadata or unambiguous free phrasing.
  if (explicitFree === true || EXPLICIT_FREE_RE.test(n)) {
    return { isFree: true, priceMin: 0, priceMax: 0 };
  }

  return { isFree: false, priceMin: null, priceMax: null };
}

export function formatPriceLabel(
  isFree: boolean,
  priceMin: number | null,
  priceMax: number | null
): string {
  if (isFree) return "Gratis";
  if (priceMin == null || priceMin <= 0) return "Precio no informado";
  const fmt = (n: number) => "$" + n.toLocaleString("es-AR");
  if (priceMax != null && priceMax > priceMin) {
    return `${fmt(priceMin)} – ${fmt(priceMax)}`;
  }
  return `Desde ${fmt(priceMin)}`;
}

const RULES: Array<{ cat: CategoryId; weight: number; re: RegExp }> = [
  {
    cat: "gastronomia",
    weight: 4,
    re: /\b(gastronomi\w*|feria\w*|degustacion\w*|vino\w*|cerveza\w*|bar\b|bares|colectividad\w*|patio gastronomico|cata\b|food|brunch|coctel\w*|mercado)\b/,
  },
  {
    cat: "talleres",
    weight: 3,
    re: /\b(taller\w*|charla\w*|workshop\w*|curso\w*|seminario\w*|conferencia\w*|congreso\w*|capacitacion\w*|masterclass|encuentro\w*|networking|simposio|jornada\w*)\b/,
  },
  {
    cat: "aire_libre",
    weight: 3,
    re: /\b(aire libre|parque\w*|plaza\w*|caminata\w*|recorrido\w*|visita\w* guiada\w*|reserva ecologica|deporte\w*|running|maraton|biciclet\w*|yoga|jardin botanico|planetario)\b/,
  },
  {
    cat: "musica",
    weight: 3,
    re: /\b(musica\w*|recital\w*|concierto\w*|banda\w*|orquesta|jazz|rock|tango|folklore|pop|electronica|dj\b|fiesta\w*|milonga|cumbia|coro|sinfonic\w*|acustic\w*|show en vivo|live)\b/,
  },
  {
    cat: "teatro",
    weight: 3,
    re: /\b(teatro|obra\w*|comedia|drama|stand\s*up|impro\w*|clown|musical\w*|danza|ballet|circo|titere\w*|infantil\w*|escenic\w*|unipersonal|monologo)\b/,
  },
  {
    cat: "arte",
    weight: 2,
    re: /\b(arte\w*|museo\w*|muestra\w*|exposicion\w*|exhibicion\w*|galeria\w*|cine|pelicula\w*|proyeccion\w*|fotografi\w*|literatura|libro\w*|poesia|lectura|cultura\w*|patrimonio)\b/,
  },
];

export function classifyEvent(
  title: string,
  description?: string | null,
  sourceCategories?: string[],
  defaultCategory?: CategoryId
): CategoryId {
  const tagsText = normText((sourceCategories ?? []).join(" "));
  const titleText = normText(title);
  const descText = normText((description ?? "").slice(0, 600));

  const scores: Record<CategoryId, number> = {
    musica: 0,
    teatro: 0,
    arte: 0,
    gastronomia: 0,
    aire_libre: 0,
    talleres: 0,
  };

  for (const r of RULES) {
    if (r.re.test(tagsText)) scores[r.cat] += r.weight * 2;
    if (r.re.test(titleText)) scores[r.cat] += r.weight * 2;
    if (r.re.test(descText)) scores[r.cat] += r.weight;
  }

  let best: CategoryId = defaultCategory ?? "arte";
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores) as Array<[CategoryId, number]>) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return bestScore > 0 ? best : (defaultCategory ?? "arte");
}

export function makeVenueKey(name: string, address?: string | null): string {
  const n =
    normText(name)
      .replace(/\b(teatro|centro cultural|espacio|sala|club|bar|museo)\b/g, "")
      .trim() || normText(name);
  const a = normText(address ?? "")
    .replace(
      /\b(av|avenida|calle|buenos aires|caba|cdad autonoma de buenos aires|argentina)\b/g,
      ""
    )
    .trim();
  const numMatch = a.match(/\b(\d{2,5})\b/);
  const streetToken = a.split(" ").find((t) => t.length >= 4 && !/^\d+$/.test(t));
  if (streetToken && numMatch) {
    return `addr:${streetToken}:${numMatch[1]}`;
  }
  return `venue:${n.slice(0, 48)}`;
}

// Same event at the same place & 30-minute time slot merges across sources.
export function makeDedupKey(title: string, venueKey: string, startsAt: Date): string {
  const cleanTitle = normText(title)
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 6)
    .join(" ");
  const bucket30m = Math.floor(startsAt.getTime() / (30 * 60 * 1000));
  return createHash("sha1")
    .update(`${cleanTitle}|${venueKey}|${bucket30m}`)
    .digest("hex")
    .slice(0, 28);
}

export function makeGroupKey(title: string, venueKey: string): string {
  const cleanTitle = normText(title).slice(0, 60);
  return createHash("sha1").update(`${cleanTitle}|${venueKey}`).digest("hex").slice(0, 20);
}

// Parse local Buenos Aires date/time ("2026-10-30", "21:00") into a UTC Date.
export function parseArtDateTime(dateStr: string, timeStr?: string | null): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!dm) return null;
  const [, y, m, d] = dm;
  const tm = /^(\d{1,2}):(\d{2})/.exec((timeStr ?? "20:00").trim());
  const hh = tm ? tm[1].padStart(2, "0") : "20";
  const mm = tm ? tm[2] : "00";
  const dt = new Date(`${y}-${m}-${d}T${hh}:${mm}:00-03:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Compute time filter windows in Buenos Aires local time (UTC-3).
export function computeTimeWindow(
  when: string | null | undefined,
  now: Date = new Date()
): { from: Date; to: Date; liveNow?: boolean } {
  const artMs = now.getTime() + ART_OFFSET_MIN * 60_000;
  const art = new Date(artMs);
  const y = art.getUTCFullYear();
  const m = String(art.getUTCMonth() + 1).padStart(2, "0");
  const d = String(art.getUTCDate()).padStart(2, "0");
  const todayStart = new Date(`${y}-${m}-${d}T00:00:00-03:00`);
  const todayEnd = new Date(`${y}-${m}-${d}T23:59:59-03:00`);

  if (when === "now") {
    return {
      from: new Date(now.getTime() - 3 * 3600_000),
      to: new Date(now.getTime() + 90 * 60_000),
      liveNow: true,
    };
  }
  if (when === "today") {
    return {
      from: new Date(Math.max(now.getTime() - 2 * 3600_000, todayStart.getTime())),
      to: todayEnd,
    };
  }
  if (when === "weekend") {
    const dow = art.getUTCDay(); // 0=Sun..6=Sat
    let daysToFri: number;
    if (dow === 5) daysToFri = 0;
    else if (dow === 6) daysToFri = -1;
    else if (dow === 0) daysToFri = -2;
    else daysToFri = 5 - dow;

    const friStart = new Date(todayStart.getTime() + daysToFri * 86_400_000);
    const sunEnd = new Date(friStart.getTime() + 3 * 86_400_000 - 1000);
    return {
      from: new Date(Math.max(now.getTime() - 2 * 3600_000, friStart.getTime())),
      to: sunEnd,
    };
  }
  if (when && /^\d{4}-\d{2}-\d{2}$/.test(when)) {
    const dayStart = new Date(`${when}T00:00:00-03:00`);
    const dayEnd = new Date(`${when}T23:59:59-03:00`);
    if (!Number.isNaN(dayStart.getTime())) {
      return { from: dayStart, to: dayEnd };
    }
  }
  // Default: upcoming 30 days.
  return {
    from: new Date(now.getTime() - 2 * 3600_000),
    to: new Date(now.getTime() + 30 * 86_400_000),
  };
}
