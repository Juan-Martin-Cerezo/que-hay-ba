import { sql } from "@/lib/db";
import { isInsideCaba, makeVenueKey, normText } from "./normalise";
import { SEED_VENUES } from "./venues-seed";

const seedLookup = new Map<string, { lat: number; lng: number; barrio: string; address: string }>();
for (const v of SEED_VENUES) {
  const entry = { lat: v.lat, lng: v.lng, barrio: v.barrio, address: v.address };
  seedLookup.set(normText(v.name), entry);
  seedLookup.set(makeVenueKey(v.name, v.address), entry);
  for (const alias of v.aliases ?? []) {
    seedLookup.set(normText(alias), entry);
  }
}

export async function resolveCoords(
  venueName: string,
  address?: string | null,
  providedLat?: number | null,
  providedLng?: number | null
): Promise<{ lat: number; lng: number } | null> {
  // 1. Source already supplied valid CABA coordinates.
  if (isInsideCaba(providedLat, providedLng)) {
    return { lat: providedLat!, lng: providedLng! };
  }

  // 2. Match against curated CABA venues seed.
  const byName = seedLookup.get(normText(venueName));
  if (byName) return { lat: byName.lat, lng: byName.lng };

  const venueKey = makeVenueKey(venueName, address);
  const byKey = seedLookup.get(venueKey);
  if (byKey) return { lat: byKey.lat, lng: byKey.lng };

  const query = normText(address || venueName);
  if (!query || query.length < 4) return null;

  const db = sql();

  // 3. Check geocode_cache in Postgres.
  const cached = await db<{ lat: number | null; lng: number | null }[]>`
    select lat, lng from geocode_cache where query = ${query} limit 1
  `;
  if (cached.length > 0) {
    const c = cached[0];
    if (isInsideCaba(c.lat, c.lng)) return { lat: c.lat!, lng: c.lng! };
    return null;
  }

  // 4. USIG (GCBA official address normaliser + geocoder, WGS84).
  const rawAddress = (address || venueName).replace(/,?\s*(caba|capital federal|buenos aires).*$/i, "").trim();
  const coords = (await geocodeUsig(rawAddress)) ?? (await geocodeNominatim(rawAddress));

  await db`
    insert into geocode_cache (query, lat, lng)
    values (${query}, ${coords?.lat ?? null}, ${coords?.lng ?? null})
    on conflict (query) do update set lat = excluded.lat, lng = excluded.lng, checked_at = now()
  `;

  return coords;
}

async function geocodeUsig(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(
      `${address}, CABA`
    )}&geocodificar=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "QueHayBA/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      direccionesNormalizadas?: Array<{
        cod_partido?: string;
        coordenadas?: { x?: string | number; y?: string | number };
      }>;
    };
    const first = data.direccionesNormalizadas?.find(
      (d) => (d.cod_partido ?? "").toLowerCase() === "caba" && d.coordenadas?.x && d.coordenadas?.y
    );
    if (!first?.coordenadas) return null;
    const lng = Number(first.coordenadas.x);
    const lat = Number(first.coordenadas.y);
    return isInsideCaba(lat, lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

async function geocodeNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = `${address}, Ciudad Autónoma de Buenos Aires, Argentina`;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=-58.532,-34.526,-58.334,-34.706&q=${encodeURIComponent(
      q
    )}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "QueHayBA/1.0 (+https://que-hay-ba.vercel.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!arr.length) return null;
    const lat = Number(arr[0].lat);
    const lng = Number(arr[0].lon);
    return isInsideCaba(lat, lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
