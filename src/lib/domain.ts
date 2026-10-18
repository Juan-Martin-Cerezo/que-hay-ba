// Shared between server and client — keep free of Node-only imports.

export const CATEGORIES = [
  { id: "musica", label: "Música", shortLabel: "Música", emoji: "🎵", color: "#7c3aed" },
  {
    id: "teatro",
    label: "Teatro y Espectáculos",
    shortLabel: "Teatro",
    emoji: "🎭",
    color: "#e11d48",
  },
  { id: "arte", label: "Arte y Cultura", shortLabel: "Arte", emoji: "🎨", color: "#ea580c" },
  {
    id: "gastronomia",
    label: "Gastronomía y Ferias",
    shortLabel: "Gastro",
    emoji: "🍔",
    color: "#d97706",
  },
  {
    id: "aire_libre",
    label: "Aire Libre y Deportes",
    shortLabel: "Aire Libre",
    emoji: "🌳",
    color: "#16a34a",
  },
  {
    id: "talleres",
    label: "Talleres y Charlas",
    shortLabel: "Talleres",
    emoji: "🎓",
    color: "#0284c7",
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];
export const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  (typeof CATEGORIES)[number]
>;

// Price buckets from the brief (ARS).
export const PRICE_FILTERS = [
  { id: "free", label: "Gratis", shortLabel: "Gratis" },
  { id: "eco", label: "Hasta $10.000", shortLabel: "≤ $10k" },
  { id: "mod", label: "$10.000 – $30.000", shortLabel: "$10k–$30k" },
  { id: "premium", label: "Más de $30.000", shortLabel: "+$30k" },
] as const;
export type PriceFilter = (typeof PRICE_FILTERS)[number]["id"];

export const WHEN_FILTERS = [
  { id: "now", label: "Ahora", emoji: "🟢" },
  { id: "today", label: "Hoy", emoji: "📅" },
  { id: "weekend", label: "Este finde", emoji: "✨" },
] as const;
export type WhenFilter = (typeof WHEN_FILTERS)[number]["id"] | "date" | "upcoming";

export const CABA_ZONES = [
  { id: "all", label: "Toda CABA", lat: -34.6037, lng: -58.4173, zoom: 12.2 },
  { id: "centro", label: "Av. Corrientes · Centro", lat: -34.6037, lng: -58.3816, zoom: 14.5 },
  { id: "palermo", label: "Palermo", lat: -34.5835, lng: -58.4285, zoom: 14.2 },
  { id: "recoleta", label: "Recoleta", lat: -34.5885, lng: -58.3935, zoom: 14.5 },
  { id: "santelmo", label: "San Telmo · La Boca", lat: -34.6215, lng: -58.3715, zoom: 14.2 },
  { id: "chacarita", label: "Chacarita · V. Crespo", lat: -34.5915, lng: -58.4455, zoom: 14.3 },
  { id: "almagro", label: "Abasto · Almagro", lat: -34.6045, lng: -58.4135, zoom: 14.5 },
  { id: "belgrano", label: "Belgrano · Núñez", lat: -34.5595, lng: -58.4565, zoom: 14.0 },
  { id: "caballito", label: "Caballito", lat: -34.6185, lng: -58.4415, zoom: 14.2 },
] as const;

export type MapThemeId = "voyager" | "light" | "dark" | "osm";

export const MAP_THEMES: ReadonlyArray<{ id: MapThemeId; label: string }> = [
  { id: "voyager", label: "Urbano CABA" },
  { id: "osm", label: "GCBA + Subte" },
  { id: "dark", label: "Nocturno" },
  { id: "light", label: "Callejero" },
];

export const SOURCE_LABELS: Record<string, string> = {
  eventbrite: "Eventbrite",
  alternativa: "Alternativa Teatral",
  gcba: "Agenda Cultural BA",
};

// Argentina has had no DST since 2009: a fixed UTC-3 offset is exact.
export const ART_OFFSET_MIN = -180;
