"use client";

import {
  CATEGORIES,
  PRICE_FILTERS,
  WHEN_FILTERS,
  type CategoryId,
  type PriceFilter,
} from "@/lib/domain";

export interface FilterState {
  q: string;
  when: string; // "" | "now" | "today" | "weekend" | "YYYY-MM-DD"
  price: PriceFilter | "";
  categories: CategoryId[];
}

interface FilterBarProps {
  filters: FilterState;
  total: number;
  loading: boolean;
  favoritesCount: number;
  locating: boolean;
  hasUserLocation: boolean;
  onChange: (next: FilterState) => void;
  onOpenFavorites: () => void;
  onLocateUser: () => void;
}

export function FilterBar({
  filters,
  total,
  loading,
  favoritesCount,
  locating,
  hasUserLocation,
  onChange,
  onOpenFavorites,
  onLocateUser,
}: FilterBarProps) {
  const customDate = /^\d{4}-\d{2}-\d{2}$/.test(filters.when) ? filters.when : "";
  const hasAnyFilter =
    Boolean(filters.q) ||
    Boolean(filters.when) ||
    Boolean(filters.price) ||
    filters.categories.length > 0;

  const toggleCategory = (cat: CategoryId) => {
    const exists = filters.categories.includes(cat);
    const nextCats = exists
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: nextCats });
  };

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 sm:p-4">
      {/* Row 1: Brand + search + quick actions */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex items-center gap-2 pl-2 pr-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white dark:bg-sky-500">
            BA
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Qué Hay BA
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {loading ? "Actualizando…" : `${total.toLocaleString("es-AR")} actividades en CABA`}
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative min-w-[180px] flex-1">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Buscar obra, banda, museo, barrio…"
            aria-label="Buscar actividades en CABA"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-sky-400"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, q: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* Near me button */}
        <button
          type="button"
          onClick={onLocateUser}
          disabled={locating}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
            hasUserLocation
              ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
          title="Usar mi ubicación"
        >
          <span>📍</span>
          <span className="hidden sm:inline">
            {locating ? "Ubicando…" : hasUserLocation ? "Cerca mío" : "Mi ubicación"}
          </span>
        </button>

        {/* Saved favourites */}
        <button
          type="button"
          onClick={onOpenFavorites}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          title="Ver favoritos guardados"
        >
          <span>❤️</span>
          <span className="hidden sm:inline">Favoritos</span>
          {favoritesCount > 0 && (
            <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-semibold text-white">
              {favoritesCount}
            </span>
          )}
        </button>
      </div>

      {/* Row 2: Time + Price chips */}
      <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WHEN_FILTERS.map((w) => {
          const active = filters.when === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onChange({ ...filters, when: active ? "" : w.id })}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white dark:border-sky-400 dark:bg-sky-500 dark:text-slate-950"
                  : "border-slate-200/90 bg-white/95 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
              }`}
            >
              {w.emoji} {w.label}
            </button>
          );
        })}

        {/* Custom calendar date picker */}
        <label
          className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition ${
            customDate
              ? "border-slate-900 bg-slate-900 text-white dark:border-sky-400 dark:bg-sky-500 dark:text-slate-950"
              : "border-slate-200/90 bg-white/95 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
          }`}
        >
          <span>📆</span>
          <span>{customDate || "Fecha"}</span>
          <input
            type="date"
            value={customDate}
            onChange={(e) => onChange({ ...filters, when: e.target.value })}
            className="sr-only"
            aria-label="Elegir fecha en el calendario"
          />
        </label>

        <span className="mx-1 h-4 w-px shrink-0 bg-slate-300 dark:bg-slate-700" />

        {PRICE_FILTERS.map((p) => {
          const active = filters.price === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...filters, price: active ? "" : p.id })}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition ${
                active
                  ? "border-emerald-700 bg-emerald-600 text-white"
                  : "border-slate-200/90 bg-white/95 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
              }`}
            >
              {p.id === "free" ? "🎟️ Gratis" : p.label}
            </button>
          );
        })}

        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => onChange({ q: "", when: "", price: "", categories: [] })}
            className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/80 dark:text-rose-200"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Row 3: Category pills */}
      <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => {
          const active = filters.categories.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategory(c.id)}
              style={
                active
                  ? { backgroundColor: c.color, borderColor: c.color, color: "#ffffff" }
                  : undefined
              }
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition ${
                active
                  ? "text-white"
                  : "border-slate-200/90 bg-white/95 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? "#ffffff" : c.color }}
              />
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
