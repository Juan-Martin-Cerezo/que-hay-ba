import { sql } from "@/lib/db";
import { isInsideCaba, parseArtDateTime, parsePrice, stripHtml } from "../normalise";
import type { RawEvent } from "../types";

interface AtFuncion {
  codigo?: number;
  nro_dia?: number;
  dia?: string;
  hora?: string;
  proxima_fecha?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

interface AtLugar {
  nombre?: string;
  direccion?: string;
  zona?: string;
  provincia?: string;
  lat?: number | string;
  lng?: number | string;
  funciones?: Record<string, AtFuncion>;
}

interface AtObra {
  titulo?: string;
  imagen_ficha?: string;
  clasificaciones?: Record<string, { padre?: number; descripcion?: string }>;
  lugares?: Record<string, AtLugar>;
  url?: string;
  url_entradas?: string;
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";

function unwrapJsonp<T>(text: string): T | null {
  const lpar = text.indexOf("(");
  const rpar = text.lastIndexOf(")");
  if (lpar === -1 || rpar <= lpar) return null;
  try {
    return JSON.parse(text.slice(lpar + 1, rpar).replace(/^\uFEFF/, "")) as T;
  } catch {
    return null;
  }
}

async function fetchTicketingPrices(obraId: string): Promise<{ min: number; max: number } | null> {
  try {
    const fRes = await fetch(
      `https://publico1.alternativateatral.com/api/formulario-localidades.asp?id=${obraId}&o=14&m=&c=&callback=cb`,
      {
        headers: { "User-Agent": UA, Referer: "https://publico.alternativateatral.com/" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!fRes.ok) return null;
    const fData = unwrapJsonp<{
      resultado?: string;
      funciones?: Array<{ id?: string; fecha?: string; descripcion?: string }>;
    }>(await fRes.text());
    const fn =
      fData?.funciones?.find((x) => x.id && x.fecha && !/agotado/i.test(x.descripcion ?? "")) ??
      fData?.funciones?.[0];
    if (!fn?.id || !fn?.fecha) return null;

    const pRes = await fetch(
      `https://publico1.alternativateatral.com/api/cargar-parametros-funcion.asp?id=${fn.id}-${fn.fecha}&o=14&m=&c=&callback=cb`,
      {
        headers: { "User-Agent": UA, Referer: "https://publico.alternativateatral.com/" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!pRes.ok) return null;
    const pData = unwrapJsonp<{
      resultado?: string;
      precios?: Array<{ importe?: string | number; moneda?: string }>;
    }>(await pRes.text());
    const vals = (pData?.precios ?? [])
      .filter((p) => !p.moneda || p.moneda === "$" || p.moneda === "ARS")
      .map((p) => Math.round(Number(p.importe)))
      .filter((v) => Number.isFinite(v) && v >= 500 && v <= 2_000_000);
    if (!vals.length) return null;
    return { min: Math.min(...vals), max: Math.max(...vals) };
  } catch {
    return null;
  }
}

async function fetchShowDetail(
  obraId: string,
  urlPath: string,
  hasTicketsUrl: boolean
): Promise<{
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  description: string | null;
} | null> {
  try {
    const fullUrl = urlPath.startsWith("http")
      ? urlPath
      : `https://www.alternativateatral.com/${urlPath.replace(/^\/+/, "")}`;
    const res = await fetch(fullUrl, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract from .content-funciones where actual venue prices live, avoiding nav <span class="mdc-list-item__text">Entradas</span>
    const funcionesBlock =
      html.match(/<div[^>]*content-funciones[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const funcionesText = stripHtml(funcionesBlock);
    let parsed = parsePrice(funcionesText);

    // If HTML block had no explicit ARS amount and show uses Alternativa online ticketing, query the official JSONP ticketing API.
    if (
      parsed.priceMin == null &&
      !parsed.isFree &&
      (hasTicketsUrl || /publico\.alternativateatral\.com\/entradas/i.test(html))
    ) {
      const apiPrices = await fetchTicketingPrices(obraId);
      if (apiPrices) {
        parsed = { isFree: false, priceMin: apiPrices.min, priceMax: apiPrices.max };
      }
    }

    const ogDesc =
      html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ?? "";
    const cleanedDesc = stripHtml(
      ogDesc.replace(/\s*en Alternativa\. Comunidad en escena\.?$/i, "")
    ).trim();

    return {
      isFree: parsed.isFree,
      priceMin: parsed.priceMin,
      priceMax: parsed.priceMax,
      description: cleanedDesc || null,
    };
  } catch {
    return null;
  }
}

export async function fetchAlternativaEvents(enrichLimit = 35): Promise<RawEvent[]> {
  // Step 1: obtain session cookies from cartelera.asp (required by get-json.php).
  const warm = await fetch("https://www.alternativateatral.com/cartelera.asp", {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(12000),
  });
  const cookies = (warm.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");

  const feedUrl = `https://www.alternativateatral.com/get-json.php?t=novedades&r=cartelera&callback=jsoncallback&_=${Date.now()}`;
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": UA,
      Referer: "https://www.alternativateatral.com/cartelera.asp",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Alternativa feed HTTP ${res.status}`);

  const text = await res.text();
  const lpar = text.indexOf("(");
  const rpar = text.lastIndexOf(")");
  if (lpar === -1 || rpar <= lpar) throw new Error("Unexpected Alternativa JSONP wrapper");
  const jsonStr = text.slice(lpar + 1, rpar).replace(/^\uFEFF/, "");
  const payload = JSON.parse(jsonStr) as { espectaculos?: Record<string, AtObra> };
  const shows = payload.espectaculos ?? {};

  // Step 2: load cached show details from Postgres.
  const db = sql();
  const cachedRows = await db<
    {
      source_id: string;
      is_free: boolean | null;
      price_min: number | null;
      price_max: number | null;
      description: string | null;
    }[]
  >`
    select source_id, is_free, price_min, price_max, description
    from detail_cache
    where source = 'alternativa'
  `;
  const detailMap = new Map(cachedRows.map((r) => [r.source_id, r]));

  // Enrich up to enrichLimit uncached (or previously price-less) CABA shows concurrently (in batches of 8).
  const cabaShowIds = Object.entries(shows)
    .filter(([, s]) => Object.values(s.lugares ?? {}).some((l) => l.provincia === "CABA"))
    .map(([id]) => id);
  const toEnrich = cabaShowIds
    .filter((id) => {
      const c = detailMap.get(id);
      if (!c) return true;
      return c.price_min == null && !c.is_free && Boolean(shows[id]?.url_entradas);
    })
    .slice(0, enrichLimit);

  for (let i = 0; i < toEnrich.length; i += 8) {
    const batch = toEnrich.slice(i, i + 8);
    await Promise.all(
      batch.map(async (obraId) => {
        const obra = shows[obraId];
        if (!obra?.url) return;
        const det = await fetchShowDetail(obraId, obra.url, Boolean(obra.url_entradas));
        if (!det) return;
        detailMap.set(obraId, {
          source_id: obraId,
          is_free: det.isFree,
          price_min: det.priceMin,
          price_max: det.priceMax,
          description: det.description,
        });
        await db`
          insert into detail_cache (source, source_id, is_free, price_min, price_max, description)
          values ('alternativa', ${obraId}, ${det.isFree}, ${det.priceMin}, ${det.priceMax}, ${det.description})
          on conflict (source, source_id) do update set
            is_free = excluded.is_free,
            price_min = excluded.price_min,
            price_max = excluded.price_max,
            description = excluded.description,
            checked_at = now()
        `;
      })
    );
  }

  const out: RawEvent[] = [];
  for (const [obraId, obra] of Object.entries(shows)) {
    const title = (obra.titulo ?? "").trim();
    if (!title || !obra.url) continue;

    const tags = Object.values(obra.clasificaciones ?? {})
      .map((c) => c.descripcion ?? "")
      .filter(Boolean);

    const imageUrl = obra.imagen_ficha
      ? obra.imagen_ficha.startsWith("http")
        ? obra.imagen_ficha
        : `https://${obra.imagen_ficha.replace(/^\/+/, "")}`
      : null;

    const officialUrl = obra.url.startsWith("http")
      ? obra.url
      : `https://www.alternativateatral.com/${obra.url.replace(/^\/+/, "")}`;

    const det = detailMap.get(obraId);

    for (const [lugarId, lugar] of Object.entries(obra.lugares ?? {})) {
      if (lugar.provincia !== "CABA") continue;
      const lat = lugar.lat != null ? Number(lugar.lat) : null;
      const lng = lugar.lng != null ? Number(lugar.lng) : null;
      const validCoords = isInsideCaba(lat, lng);

      const seenSlots = new Set<string>();
      for (const fn of Object.values(lugar.funciones ?? {})) {
        if (!fn.proxima_fecha) continue;
        const [datePart, timePart] = fn.proxima_fecha.trim().split(/\s+/);
        if (!datePart) continue;
        const slotKey = `${datePart}T${timePart || fn.hora || "21:00"}`;
        if (seenSlots.has(slotKey)) continue;
        seenSlots.add(slotKey);

        const startsAt = parseArtDateTime(datePart, timePart || fn.hora || "21:00");
        if (!startsAt) continue;

        out.push({
          source: "alternativa",
          sourceId: `${obraId}:${lugarId}:${slotKey}`,
          title,
          description: det?.description ?? null,
          imageUrl,
          url: officialUrl,
          ticketsUrl: obra.url_entradas || officialUrl,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 90 * 60_000),
          venueName: (lugar.nombre || "Sala CABA").trim(),
          address: lugar.direccion?.trim() || null,
          barrio: lugar.zona?.trim() || null,
          lat: validCoords ? lat : null,
          lng: validCoords ? lng : null,
          isFree: det?.is_free ?? null,
          priceMin: det?.price_min ?? null,
          priceMax: det?.price_max ?? null,
          sourceCategories: tags.length ? tags : ["Teatro"],
        });
      }
    }
  }

  return out;
}
