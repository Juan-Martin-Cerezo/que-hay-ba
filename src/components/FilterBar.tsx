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
  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent";
const chipIdle = "border-line text-muted hover:border-white/20 hover:text-fg";
const chipOn = "border-fg bg-fg text-ink";

export function FilterBar({ filters, activeZone, onChange, onSelectZone, onFocusSearch }: FilterBarProps) {
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
    <div className="space-y-3">
      {/* Search */}
      <label className="relative block">
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
          className="h-11 w-full rounded-xl border border-line bg-raised pl-10 pr-10 text-sm text-fg placeholder:text-muted/70 focus:border-white/25 focus:outline-none"
        />
        {filters.q && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, q: "" })}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-fg"
          >
            ✕
          </button>
        )}
      </label>

      {/* When + free */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
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
              {w.id === "now" && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />}
              {w.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={filters.price === "free"}
          onClick={() => onChange({ ...filters, price: filters.price === "free" ? "" : "free" })}
          className={`${chip} ${filters.price === "free" ? "border-emerald-400 bg-emerald-400 text-ink" : chipIdle}`}
        >
          Gratis
        </button>
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
          className={`${chip} ${more || customDate || (filters.price && filters.price !== "free") || activeZone !== "all" ? "border-accent text-accent" : chipIdle}`}
        >
          Más filtros
        </button>
      </div>

      {/* Categories */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {CATEGORIES.map((c) => {
          const on = filters.categories.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleCat(c.id)}
              className={`${chip} flex items-center gap-2 ${on ? "text-ink" : chipIdle}`}
              style={on ? { background: c.color, borderColor: c.color, color: "#09090b" } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: on ? "#09090b" : c.color }} />
              {c.shortLabel}
            </button>
          );
        })}
      </div>

      {more && (
        <div className="space-y-3 rounded-xl border border-line bg-raised/60 p-3">
          <Group title="Barrio">
            {CABA_ZONES.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => onSelectZone(z)}
                className={`${chip} ${activeZone === z.id ? chipOn : chipIdle}`}
              >
                {z.label}
              </button>
            ))}
          </Group>
          <Group title="Precio">
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
          <Group title="Fecha">
            <input
              type="date"
              value={customDate}
              onChange={(e) => onChange({ ...filters, when: e.target.value })}
              className="h-9 rounded-lg border border-line bg-ink px-3 font-mono text-xs text-fg focus:border-white/25 focus:outline-none"
            />
          </Group>
        </div>
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Limpiar {activeCount} {activeCount === 1 ? "filtro" : "filtros"}
        </button>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
