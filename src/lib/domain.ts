// Shared between server and client — keep free of Node-only imports.

export const CATEGORIES = [
  { id: "musica", label: "Música", emoji: "🎵", color: "#7c3aed" },
  { id: "teatro", label: "Teatro y Espectáculos", emoji: "🎭", color: "#e11d48" },
  { id: "arte", label: "Arte y Cultura", emoji: "🎨", color: "#ea580c" },
  { id: "gastronomia", label: "Gastronomía y Ferias", emoji: "🍔", color: "#ca8a04" },
  { id: "aire_libre", label: "Aire Libre y Deportes", emoji: "🌳", color: "#16a34a" },
  { id: "talleres", label: "Talleres y Charlas", emoji: "🎓", color: "#0284c7" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];
export const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  (typeof CATEGORIES)[number]
>;

// Price buckets from the brief (ARS).
export const PRICE_FILTERS = [
  { id: "free", label: "Gratis" },
  { id: "eco", label: "Hasta $10.000" },
  { id: "mod", label: "$10.000 – $30.000" },
  { id: "premium", label: "Más de $30.000" },
] as const;
export type PriceFilter = (typeof PRICE_FILTERS)[number]["id"];

export const WHEN_FILTERS = [
  { id: "now", label: "En vivo ahora", emoji: "🟢" },
  { id: "today", label: "Hoy", emoji: "📅" },
  { id: "weekend", label: "Este finde", emoji: "🗓️" },
] as const;
export type WhenFilter = (typeof WHEN_FILTERS)[number]["id"] | "date" | "upcoming";

export const SOURCE_LABELS: Record<string, string> = {
  eventbrite: "Eventbrite",
  alternativa: "Alternativa Teatral",
  gcba: "Agenda Ciudad de Buenos Aires",
};

// Argentina has had no DST since 2009: a fixed UTC-3 offset is exact.
export const ART_OFFSET_MIN = -180;
