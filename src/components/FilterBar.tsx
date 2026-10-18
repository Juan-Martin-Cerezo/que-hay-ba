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
      {/* Top Editorial Command Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-900/12 bg-[#fcfaf5]/95 p-2 shadow-2xl shadow-slate-950/15 backdrop-blur-xl dark:border-white/12 dark:bg-[#0b0f19]/95">
        {/* Porteño Editorial Masthead */}
        <div className="flex items-center gap-2.5 pl-1.5 pr-1">
          <div className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-white/20 bg-slate-950 text-white shadow-md dark:bg-rose-600">
            <span className="font-display text-xs font-extrabold leading-none tracking-tight">
              BA
            </span>
            <span className="font-mono-tabular mt-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-300 dark:text-white/90">
              VIVO
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#fcfaf5] bg-emerald-500 dark:border-[#0b0f19]" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-base font-extrabold tracking-tight text-slate-950 sm:text-lg dark:text-white">
                Qué Hay BA
              </h1>
              <span className="font-mono-tabular hidden rounded-md border border-slate-900/15 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 sm:inline-block dark:border-amber-400/25 dark:bg-amber-400/15 dark:text-amber-300">
                34°36′S · CABA
              </span>
            </div>
            <p className="font-mono-tabular text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {loading ? (
                <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-rose-500" />
                  Sincronizando cartelera…
                </span>
              ) : (
                `${total.toLocaleString("es-AR")} experiencias geolocalizadas`
              )}
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[165px] flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Buscar obra, recital, centro cultural, museo, barrio…"
            aria-label="Buscar actividades en CABA"
            className="w-full rounded-xl border border-slate-900/12 bg-white/90 py-2 pl-9 pr-8 text-xs font-semibold text-slate-900 placeholder:text-slate-400 transition focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 sm:text-sm dark:border-white/12 dark:bg-slate-900/90 dark:text-white dark:focus:border-rose-500"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, q: "" })}
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
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
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
            moreOpen || filters.price || customDate || activeZone !== "all"
              ? "border-slate-900 bg-slate-900 text-white dark:border-rose-500 dark:bg-rose-600"
              : "border-slate-900/12 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/12 dark:bg-slate-800/90 dark:text-slate-100"
          }`}
          title="Barrios, precios y capas del mapa"
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
          <span className="hidden md:inline">Barrios y Capas</span>
          <span className="md:hidden">Filtros</span>
        </button>

        {/* Near Me GPS Button */}
        <button
          type="button"
          onClick={onLocateUser}
          disabled={locating}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
            hasUserLocation
              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
              : "border-slate-900/12 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/12 dark:bg-slate-800/90 dark:text-slate-100"
          }`}
          title="Centrar en mi ubicación actual"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
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
          className="flex items-center gap-1.5 rounded-xl border border-slate-900/12 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100 dark:border-white/12 dark:bg-slate-800/90 dark:text-slate-100"
          title="Ver agenda guardada"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill={favoritesCount > 0 ? "#e11d48" : "none"}
            stroke={favoritesCount > 0 ? "#e11d48" : "currentColor"}
            strokeWidth="2.2"
            className="h-3.5 w-3.5"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          <span className="hidden sm:inline">Mi Agenda</span>
          {favoritesCount > 0 && (
            <span className="font-mono-tabular rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {favoritesCount}
            </span>
          )}
        </button>
      </div>

      {/* Row 2: Interactive Icon Legend + Quick-Filter Rail */}
      <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WHEN_FILTERS.map((w) => {
          const active = filters.when === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onChange({ ...filters, when: active ? "" : w.id })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md transition ${
                active
                  ? "border-slate-950 bg-slate-950 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950"
                  : "border-slate-900/12 bg-[#fcfaf5]/95 text-slate-800 hover:bg-white dark:border-white/12 dark:bg-[#0b0f19]/92 dark:text-slate-200"
              }`}
            >
              {w.emoji} {w.label}
            </button>
          );
        })}

        {/* One-tap Gratis toggle matching the "$0" map pin badge */}
        <button
          type="button"
          onClick={() =>
            onChange({ ...filters, price: filters.price === "free" ? "" : "free" })
          }
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold shadow-md backdrop-blur-md transition ${
            filters.price === "free"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/30"
              : "border-slate-900/12 bg-[#fcfaf5]/95 text-slate-800 hover:bg-white dark:border-white/12 dark:bg-[#0b0f19]/92 dark:text-slate-200"
          }`}
        >
          <span className="font-mono-tabular rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] font-black text-white">
            $0
          </span>
          <span>Gratis</span>
        </button>

        <span className="mx-0.5 h-4 w-px shrink-0 bg-slate-400/50 dark:bg-slate-700" />

        {/* Map Icon Legend Category Pills */}
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
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shadow-md backdrop-blur-md transition hover:scale-[1.02] ${
                active
                  ? "text-white ring-2 ring-white/50"
                  : "border-slate-900/12 bg-[#fcfaf5]/95 text-slate-800 hover:bg-white dark:border-white/12 dark:bg-[#0b0f19]/92 dark:text-slate-200"
              }`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white shadow-xs"
                style={{ backgroundColor: active ? "rgba(0,0,0,0.22)" : c.color }}
              >
                {c.emoji}
              </span>
              <span className="hidden sm:inline">{c.label}</span>
              <span className="sm:hidden">{c.shortLabel}</span>
            </button>
          );
        })}

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ q: "", when: "", price: "", categories: [] })}
            className="shrink-0 rounded-full border border-rose-500/30 bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-md hover:bg-rose-500"
          >
            ✕ Limpiar ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Expandable Tray: Barrios / Zones, Price Ranges, Calendar Date, & Map Style */}
      {moreOpen && (
        <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-slate-900/15 bg-[#fcfaf5]/98 p-4 shadow-2xl backdrop-blur-xl sm:max-w-3xl dark:border-white/15 dark:bg-[#0b0f19]/98">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Explorar por corredor cultural / barrio
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white dark:border-rose-500 dark:bg-rose-600"
                        : "border-slate-900/10 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {z.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-900/10 pt-3 sm:grid-cols-3 dark:border-white/10">
            {/* Price Buckets */}
            <div>
              <span className="font-mono-tabular mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Presupuesto (ARS)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRICE_FILTERS.map((p) => {
                  const active = filters.price === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChange({ ...filters, price: active ? "" : p.id })}
                      className={`font-mono-tabular rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-900/10 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
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
              <span className="font-mono-tabular mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Fecha en calendario
              </span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => onChange({ ...filters, when: e.target.value })}
                aria-label="Elegir fecha en el calendario"
                className="font-mono-tabular w-full rounded-xl border border-slate-900/10 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-slate-900 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Map Visual Theme Switcher */}
            <div>
              <span className="font-mono-tabular mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Cartografía base
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {MAP_THEMES.map((t) => {
                  const active = mapTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onChangeTheme(t.id)}
                      className={`rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? "border-slate-950 bg-slate-950 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950"
                          : "border-slate-900/10 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
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
