"use client";

import { useState } from "react";
import {
  CABA_ZONES,
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

export const EMPTY_FILTERS: FilterState = { q: "", when: "", price: "", categories: [] };

interface FilterBarProps {
  filters: FilterState;
  activeZone: string;
  onChange: (next: FilterState) => void;
  onSelectZone: (zone: (typeof CABA_ZONES)[number]) => void;
  onFocusSearch?: () => void;
}

const chip =
  "shrink-0 min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98]";
const chipIdle = "border-line bg-ink/70 text-muted hover:border-white/25 hover:text-fg";
const chipOn = "border-fg bg-fg text-ink font-semibold shadow-sm";

export function FilterBar({
  filters,
  activeZone,
  compact = false,
  onChange,
  onSelectZone,
  onFocusSearch,
}: FilterBarProps & { compact?: boolean }) {
  const [more, setMore] = useState(false);
  const customDate = /^\d{4}-\d{2}-\d{2}$/.test(filters.when) ? filters.when : "";
  const activeCount =
    (filters.q ? 1 : 0) + (filters.when ? 1 : 0) + (filters.price ? 1 : 0) + filters.categories.length;

  const toggleCat = (id: CategoryId) =>
    onChange({
      ...filters,
      categories: filters.categories.includes(id)
        ? filters.categories.filter((c) => c !== id)
        : [...filters.categories, id],
    });

  return (
    <div className="space-y-2">
      {/* Search + quick filter button */}
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar actividades</span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={filters.q}
            onFocus={onFocusSearch}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Obra, banda, museo, barrio…"
            className="h-11 w-full rounded-xl border border-line bg-raised pl-10 pr-10 text-base md:text-sm text-fg placeholder:text-muted/80 focus:border-accent/60 focus:outline-none"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, q: "" })}
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-fg"
            >
              ✕
            </button>
          )}
        </label>

        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
          className={`flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium transition-colors ${
            more || customDate || (filters.price && filters.price !== "free") || activeZone !== "all"
              ? "border-accent bg-accent/15 text-accent"
              : "border-line bg-raised text-muted hover:text-fg"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          <span>Filtros</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* When + Gratis + Categories unified on compact/mobile, or split on desktop */}
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {WHEN_FILTERS.map((w) => {
          const on = filters.when === w.id;
          return (
            <button
              key={w.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...filters, when: on ? "" : w.id })}
              className={`${chip} ${on ? chipOn : chipIdle}`}
            >
              {w.id === "now" && (
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
              )}
              {w.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={filters.price === "free"}
          onClick={() => onChange({ ...filters, price: filters.price === "free" ? "" : "free" })}
          className={`${chip} ${
            filters.price === "free"
              ? "border-emerald-400 bg-emerald-400 font-semibold text-ink"
              : chipIdle
          }`}
        >
          $0 Gratis
        </button>
        {compact &&
          CATEGORIES.map((c) => {
            const on = filters.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCat(c.id)}
                className={`${chip} flex items-center gap-1.5 ${on ? "text-ink font-semibold" : chipIdle}`}
                style={on ? { background: c.color, borderColor: c.color, color: "#09090b" } : undefined}
              >
                <span className="text-xs leading-none">{c.emoji}</span>
                <span>{c.shortLabel}</span>
              </button>
            );
          })}
      </div>

      {/* Categories row on larger viewports */}
      {!compact && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {CATEGORIES.map((c) => {
            const on = filters.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCat(c.id)}
                className={`${chip} flex items-center gap-1.5 ${on ? "text-ink font-semibold" : chipIdle}`}
                style={on ? { background: c.color, borderColor: c.color, color: "#09090b" } : undefined}
              >
                <span className="text-xs leading-none">{c.emoji}</span>
                <span>{c.shortLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {more && (
        <div className="max-h-[60dvh] space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-raised/98 p-3.5 shadow-2xl">
          <Group title="Barrio / Zona">
            {CABA_ZONES.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => {
                  onSelectZone(z);
                  if (compact) setMore(false);
                }}
                className={`${chip} ${activeZone === z.id ? chipOn : chipIdle}`}
              >
                {z.label}
              </button>
            ))}
          </Group>
          <Group title="Presupuesto confirmado">
            {PRICE_FILTERS.map((p) => {
              const on = filters.price === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ ...filters, price: on ? "" : p.id })}
                  className={`${chip} font-mono ${on ? chipOn : chipIdle}`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </Group>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="font-mono text-[10px] uppercase tracking-wider">Fecha:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => onChange({ ...filters, when: e.target.value })}
                className="h-10 rounded-xl border border-line bg-ink px-3 font-mono text-sm text-fg focus:border-accent/60 focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(EMPTY_FILTERS);
                    setMore(false);
                  }}
                  className="min-h-10 px-2 text-xs font-medium text-accent hover:underline"
                >
                  Limpiar todo
                </button>
              )}
              <button
                type="button"
                onClick={() => setMore(false)}
                className="min-h-10 rounded-xl bg-fg px-3.5 text-xs font-semibold text-ink"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
