"use client";

import { useState } from "react";
import {
  CABA_ZONES,
  CATEGORIES,
  MAP_THEMES,
  PRICE_FILTERS,
  WHEN_FILTERS,
  type CategoryId,
  type MapThemeId,
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
  activeZone: string;
  mapTheme: MapThemeId;
  onChange: (next: FilterState) => void;
  onSelectZone: (zone: (typeof CABA_ZONES)[number]) => void;
  onChangeTheme: (theme: MapThemeId) => void;
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
  activeZone,
  mapTheme,
  onChange,
  onSelectZone,
  onChangeTheme,
  onOpenFavorites,
  onLocateUser,
}: FilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const customDate = /^\d{4}-\d{2}-\d{2}$/.test(filters.when) ? filters.when : "";

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    (filters.when ? 1 : 0) +
    (filters.price ? 1 : 0) +
    filters.categories.length;

  const toggleCategory = (cat: CategoryId) => {
    const exists = filters.categories.includes(cat);
    const nextCats = exists
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: nextCats });
  };

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-2.5 sm:p-3.5">
      {/* Top Floating Command Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/92 p-2 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-900/92">
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5 pl-1.5 pr-1">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 text-xs font-extrabold tracking-tight text-white shadow-md shadow-blue-600/25">
            BA
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                Qué Hay BA
              </h1>
              <span className="hidden rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 sm:inline-block dark:bg-sky-400/15 dark:text-sky-300">
                CABA En Vivo
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {loading ? (
                <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-sky-500" />
                  Actualizando mapa…
                </span>
              ) : (
                `${total.toLocaleString("es-AR")} planes activos`
              )}
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[160px] flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Buscar obra, recital, teatro, museo, barrio…"
            aria-label="Buscar actividades en CABA"
            className="w-full rounded-xl border border-slate-200/90 bg-slate-100/80 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 sm:text-sm dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-white dark:focus:border-sky-400 dark:focus:bg-slate-800"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, q: "" })}
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* Zone / More Filters Toggle */}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            moreOpen || filters.price || customDate || activeZone !== "all"
              ? "border-indigo-500/40 bg-indigo-50 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-950/60 dark:text-indigo-300"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
          title="Barrios, precios y estilo de mapa"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
          >
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
          </svg>
          <span className="hidden md:inline">Barrios y Mapa</span>
          <span className="md:hidden">Opciones</span>
        </button>

        {/* Near Me GPS Button */}
        <button
          type="button"
          onClick={onLocateUser}
          disabled={locating}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            hasUserLocation
              ? "border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-500/30"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
          title="Centrar en mi ubicación actual"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-3.5 w-3.5 ${locating ? "animate-spin" : ""}`}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          </svg>
          <span className="hidden sm:inline">
            {locating ? "Ubicando…" : hasUserLocation ? "Cerca mío" : "Mi ubicación"}
          </span>
        </button>

        {/* Saved Favourites */}
        <button
          type="button"
          onClick={onOpenFavorites}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          title="Ver planes guardados"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill={favoritesCount > 0 ? "#e11d48" : "none"}
            stroke={favoritesCount > 0 ? "#e11d48" : "currentColor"}
            strokeWidth="2"
            className="h-3.5 w-3.5"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          <span className="hidden sm:inline">Guardados</span>
          {favoritesCount > 0 && (
            <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {favoritesCount}
            </span>
          )}
        </button>
      </div>

      {/* Row 2: Unified Quick-Filter Rail (Time + Gratis + Categories) */}
      <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WHEN_FILTERS.map((w) => {
          const active = filters.when === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onChange({ ...filters, when: active ? "" : w.id })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white dark:border-sky-400 dark:bg-sky-500 dark:text-slate-950"
                  : "border-slate-200/90 bg-white/92 text-slate-700 hover:bg-white dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-slate-200"
              }`}
            >
              {w.emoji} {w.label}
            </button>
          );
        })}

        {/* One-tap Gratis toggle */}
        <button
          type="button"
          onClick={() =>
            onChange({ ...filters, price: filters.price === "free" ? "" : "free" })
          }
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
            filters.price === "free"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/25"
              : "border-slate-200/90 bg-white/92 text-slate-700 hover:bg-white dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-slate-200"
          }`}
        >
          🎟️ Gratis
        </button>

        <span className="mx-0.5 h-4 w-px shrink-0 bg-slate-300/80 dark:bg-slate-700" />

        {/* Category Pills */}
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
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
                active
                  ? "text-white shadow-md"
                  : "border-slate-200/90 bg-white/92 text-slate-700 hover:bg-white dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-slate-200"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? "#ffffff" : c.color }}
              />
              <span>{c.emoji}</span>
              <span className="hidden sm:inline">{c.label}</span>
              <span className="sm:hidden">{c.shortLabel}</span>
            </button>
          );
        })}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ q: "", when: "", price: "", categories: [] })}
            className="shrink-0 rounded-full border border-rose-300 bg-rose-50/95 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-200"
          >
            ✕ Limpiar ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Expandable Tray: Barrios / Zones, Price Ranges, Calendar Date, & Map Style */}
      {moreOpen && (
        <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl sm:max-w-3xl dark:border-slate-800 dark:bg-slate-900/95">
          {/* Barrios / Zonas de CABA */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Ir rápido por zona / barrio
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CABA_ZONES.map((z) => {
                const active = activeZone === z.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => onSelectZone(z)}
                    className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {z.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-2.5 sm:grid-cols-3 dark:border-slate-800">
            {/* Price Buckets */}
            <div>
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Rango de precio
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRICE_FILTERS.map((p) => {
                  const active = filters.price === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChange({ ...filters, price: active ? "" : p.id })}
                      className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {p.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Picker */}
            <div>
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Fecha específica
              </span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => onChange({ ...filters, when: e.target.value })}
                aria-label="Elegir fecha en el calendario"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Map Visual Theme Switcher */}
            <div>
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Estilo visual del mapa
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {MAP_THEMES.map((t) => {
                  const active = mapTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onChangeTheme(t.id)}
                      className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white dark:border-sky-400 dark:bg-sky-500 dark:text-slate-950"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
