import { isInsideCaba, parsePrice, stripHtml } from "../normalise";
import type { RawEvent } from "../types";

interface GcbaEvent {
  id: string;
  title?: string;
  description?: string | null;
  componentes?: string[];
  imageUrl?: string | null;
  imagenes?: string[];
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fechasDelEvento?: string[];
  precio?: string | number | null;
  acceso?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  etiquetas?: string[];
  tipoEvento?: string | null;
  link?: string | null;
  pathAlias?: string | null;
  slug?: string | null;
  botonesSidebar?: Array<{ uri?: string; title?: string }>;
  ubicacion?: {
    titulo?: string | null;
    direccion?: string | null;
    latitud?: number | string | null;
    longitud?: number | string | null;
  } | null;
}

interface GcbaResponse {
  events?: GcbaEvent[];
  pagination?: {
    page?: number;
    totalPages?: number;
    total?: number;
  };
}

const BASE = "https://linda.buenosaires.gob.ar";

// The API still reports the retired /descubrir/<slug> pathAlias; live pages live at /eventos/<slug>.
export function buildGcbaUrl(ev: Pick<GcbaEvent, "pathAlias" | "slug">): string {
  const path = ev.pathAlias || (ev.slug ? `/eventos/${ev.slug}` : "/agenda");
  if (path.startsWith("http")) return path;
  const fixed = path.replace(/^\/descubrir\/?(.*)$/, (_m, rest: string) =>
    rest ? `/eventos/${rest}` : "/agenda"
  );
  return `${BASE}${fixed}`;
}

export async function fetchGcbaEvents(maxPages = 8): Promise<RawEvent[]> {
  const results: RawEvent[] = [];
  const now = Date.now();
  const minTime = now - 6 * 3600_000;
  const maxTime = now + 90 * 86_400_000;

  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, maxPages); page++) {
    let data: GcbaResponse | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${BASE}/api/frontend/events/filter?page=${page}&limit=50`, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) QueHayBA/1.0",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          data = (await res.json()) as GcbaResponse;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (!data) continue;
    totalPages = data.pagination?.totalPages ?? totalPages;

    for (const ev of data.events ?? []) {
      const title = (ev.title ?? "").trim();
      if (!title) continue;

      const latRaw = ev.ubicacion?.latitud != null ? Number(ev.ubicacion.latitud) : null;
      const lngRaw = ev.ubicacion?.longitud != null ? Number(ev.ubicacion.longitud) : null;
      const lat = isInsideCaba(latRaw, lngRaw) ? latRaw : null;
      const lng = isInsideCaba(latRaw, lngRaw) ? lngRaw : null;

      const address = (ev.ubicacion?.direccion || ev.direccion || "").trim() || null;
      const venueName = (ev.ubicacion?.titulo || address || "Ciudad de Buenos Aires").trim();
      if (!lat && !address) continue;

      const bodyHtml = [ev.description ?? "", ...(ev.componentes ?? [])].join("\n");
      const cleanBody = stripHtml(bodyHtml)
        .replace(/Este es un espacio de difusi[oó]n abierto y gratuito[\s\S]*$/i, "")
        .trim();
      const description = cleanBody.slice(0, 1200) || null;

      // ponytail: strict GCBA price verification — never trust sin_costo if it links to a paid ticketing portal without explicit free confirmation in the body
      const sidebarUris = (ev.botonesSidebar ?? [])
        .map((b) => `${b.title ?? ""} ${b.uri ?? ""}`)
        .join(" ");
      const hasPaidTicketingLink =
        /ticketek|allaccess|plateanet|tuentrada|passline|entradauno|movistararena|alternativateatral|complejoteatral|entradasba\.buenosaires\.gob\.ar/i.test(
          `${ev.link ?? ""} ${sidebarUris}`
        );
      const hasExplicitFreeBody =
        /\b(entrada libre y gratuita|libre y gratuit[oa]|entrada gratuita|actividad gratuita|sin costo|sin cargo|acceso libre y gratuito|acceso gratuito)\b/i.test(
          cleanBody
        );
      const isPaidAccess =
        ev.acceso === "con_entrada_paga" ||
        /\b(arancelad[oa]|con entrada paga|con costo)\b/i.test(cleanBody);

      const verifiedFree =
        !isPaidAccess &&
        (ev.acceso === "sin_costo" || ev.acceso === "gratuito" || ev.acceso === "libre"
          ? !hasPaidTicketingLink || hasExplicitFreeBody
          : hasExplicitFreeBody);

      const priceInfo = parsePrice(
        typeof ev.precio === "string" ? `${ev.precio}\n${cleanBody}` : cleanBody,
        isPaidAccess ? false : verifiedFree ? true : null,
        typeof ev.precio === "number" && ev.precio > 0 ? ev.precio : null
      );

      // Determine upcoming date(s) for this event (up to 3 nearest future occurrences).
      const candidateDates = (ev.fechasDelEvento?.length ? ev.fechasDelEvento : [ev.fechaInicio])
        .filter((d): d is string => Boolean(d))
        .map((d) => new Date(d))
        .filter(
          (d) => !Number.isNaN(d.getTime()) && d.getTime() >= minTime && d.getTime() <= maxTime
        )
        .sort((a, b) => a.getTime() - b.getTime());

      // If fechaInicio is in the past (long-running exhibition) but fechaFin is in the future, anchor to today 14:00 ART.
      if (candidateDates.length === 0 && ev.fechaFin) {
        const end = new Date(ev.fechaFin);
        if (!Number.isNaN(end.getTime()) && end.getTime() >= now) {
          const todayArt = new Date(now - 3 * 3600_000).toISOString().slice(0, 10);
          candidateDates.push(new Date(`${todayArt}T14:00:00-03:00`));
        }
      }

      const officialUrl = buildGcbaUrl(ev);
      const sidebarTicketUrl =
        ev.botonesSidebar?.find((b) => b.uri?.startsWith("http"))?.uri ?? null;
      const barrio = ev.barrio
        ? ev.barrio.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : null;
      const cats = [
        ...(ev.etiquetas ?? []),
        ...(ev.tipoEvento ? [ev.tipoEvento.replace(/_/g, " ")] : []),
      ];

      for (const startsAt of candidateDates.slice(0, 3)) {
        results.push({
          source: "gcba",
          sourceId: `${ev.id}:${startsAt.toISOString().slice(0, 13)}`,
          title,
          description,
          imageUrl: ev.imageUrl || ev.imagenes?.[0] || null,
          url: officialUrl,
          ticketsUrl: ev.link || sidebarTicketUrl || officialUrl,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
          venueName,
          address,
          barrio,
          lat,
          lng,
          isFree: priceInfo.isFree,
          priceMin: priceInfo.priceMin,
          priceMax: priceInfo.priceMax,
          sourceCategories: cats,
        });
      }
    }
  }

  return results;
}
