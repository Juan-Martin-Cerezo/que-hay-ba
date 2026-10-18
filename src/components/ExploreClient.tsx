"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CABA_ZONES, MAP_THEMES, categoryById, type MapThemeId } from "@/lib/domain";
import { useFavorites, type FavoriteItem } from "@/lib/favorites";
import { distanceKm, formatEventDate } from "@/lib/format";
import { EventSheet } from "./EventSheet";
import { FavoritesDrawer } from "./FavoritesDrawer";
import { EMPTY_FILTERS, FilterBar, type FilterState } from "./FilterBar";
import { MapView, type EventsGeoJSON, type MapEventProperties } from "./MapView";

const EMPTY_GEOJSON: EventsGeoJSON = { type: "FeatureCollection", total: 0, features: [] };

type SortMode = "upcoming" | "free" | "nearest";
type Sheet = "peek" | "half" | "full";

// Mobile bottom-sheet heights. Desktop ignores these (panel is a full-height column).
const SHEET_HEIGHT: Record<Sheet, string> = { peek: "184px", half: "52dvh", full: "88dvh" };
const NEXT_SHEET: Record<Sheet, Sheet> = { peek: "half", half: "full", full: "peek" };

export function ExploreClient() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<EventsGeoJSON>(EMPTY_GEOJSON);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapEventProperties | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("peek");
  const [sortMode, setSortMode] = useState<SortMode>("upcoming");
  const [activeZone, setActiveZone] = useState("all");
  const [mapTheme, setMapTheme] = useState<MapThemeId>("dark");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number; ts: number } | null>(null);

  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 220);
    return () => clearTimeout(t);
  }, [filters.q]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (filters.when) p.set("when", filters.when);
    if (filters.price) p.set("price", filters.price);
    if (filters.categories.length) p.set("cat", filters.categories.join(","));
    return p.toString();
  }, [debouncedQ, filters.when, filters.price, filters.categories]);

  const loading = loadedKey !== queryString;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/events?${queryString}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: EventsGeoJSON) => {
        if (!ctrl.signal.aborted && d?.features) {
          setData(d);
          setLoadedKey(queryString);
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoadedKey(queryString);
      });
    return () => ctrl.abort();
  }, [queryString]);

  const selectEvent = useCallback((ev: MapEventProperties) => {
    setSelected(ev);
    setFlyTarget({ lat: ev.lat, lng: ev.lng, zoom: 15.6, ts: Date.now() });
    setSheet("peek");
  }, []);

  const selectZone = useCallback((z: (typeof CABA_ZONES)[number]) => {
    setActiveZone(z.id);
    setFlyTarget({ lat: z.lat, lng: z.lng, zoom: z.zoom, ts: Date.now() });
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setSortMode("nearest");
        setFlyTarget({ ...loc, zoom: 14.5, ts: Date.now() });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const events = useMemo(() => {
    const list = data.features.map((f) => f.properties);
    if (sortMode === "nearest" && userLocation) {
      const d = (e: MapEventProperties) => distanceKm(userLocation.lat, userLocation.lng, e.lat, e.lng);
      return [...list].sort((a, b) => d(a) - d(b)).slice(0, 120);
    }
    if (sortMode === "free") return [...list].sort((a, b) => Number(b.isFree) - Number(a.isFree)).slice(0, 120);
    return list.slice(0, 120);
  }, [data.features, sortMode, userLocation]);

  const siblings = useMemo(() => {
    if (!selected) return [];
    const key = `${selected.lat.toFixed(4)},${selected.lng.toFixed(4)}`;
    return data.features
      .map((f) => f.properties)
      .filter((e) => `${e.lat.toFixed(4)},${e.lng.toFixed(4)}` === key);
  }, [data.features, selected]);

  const selectFavorite = useCallback(
    (item: FavoriteItem) => {
      setFavoritesOpen(false);
      const existing = data.features.find((f) => f.properties.id === item.id)?.properties;
      if (existing) return selectEvent(existing);
      setFlyTarget({ lat: item.lat, lng: item.lng, zoom: 15.6, ts: Date.now() });
      fetch(`/api/events/${item.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((ev) => ev && setSelected(ev))
        .catch(() => {});
    },
    [data.features, selectEvent]
  );

  const cycleTheme = () => {
    const i = MAP_THEMES.findIndex((t) => t.id === mapTheme);
    setMapTheme(MAP_THEMES[(i + 1) % MAP_THEMES.length].id);
  };
  const themeLabel = MAP_THEMES.find((t) => t.id === mapTheme)?.label ?? "";

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-ink text-fg">
      <MapView
        data={data}
        selectedId={selected?.id ?? null}
        hoveredId={hoveredId}
        mapTheme={mapTheme}
        userLocation={userLocation}
        flyTarget={flyTarget}
        onSelectEvent={selectEvent}
      />

      {/* Floating map tools — top right on every breakpoint */}
      <div className="pointer-events-none absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex gap-2 lg:right-16">
        <ToolButton onClick={cycleTheme} label={`Capa: ${themeLabel}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="m12 3 9 5-9 5-9-5 9-5Z" />
            <path d="m3 13 9 5 9-5" />
          </svg>
          <span className="hidden sm:inline">{themeLabel}</span>
        </ToolButton>
        <ToolButton onClick={locate} label="Mi ubicación" active={Boolean(userLocation)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 ${locating ? "animate-spin" : ""}`}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </ToolButton>
      </div>

      {/* Panel: bottom sheet on mobile/tablet, fixed left column on desktop */}
      <section
        aria-label="Actividades"
        style={{ ["--sheet-h" as string]: SHEET_HEIGHT[sheet] }}
        className="absolute inset-x-0 bottom-0 z-20 flex h-[var(--sheet-h)] flex-col rounded-t-3xl border-t border-line bg-panel/95 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-[height] duration-300 ease-out sm:inset-x-3 sm:bottom-3 sm:rounded-3xl sm:border md:left-3 md:right-auto md:w-[400px] lg:top-3 lg:h-auto lg:w-[380px]"
      >
        {/* Drag handle (mobile/tablet only) */}
        <button
          type="button"
          onClick={() => setSheet((s) => NEXT_SHEET[s])}
          aria-label={sheet === "full" ? "Contraer listado" : "Expandir listado"}
          className="flex w-full shrink-0 justify-center pb-1 pt-2.5 lg:hidden"
        >
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </button>

        <header className="shrink-0 space-y-3 px-4 pb-3 lg:pt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-[26px] leading-none tracking-tight">
                Qué hay <em className="text-accent">BA</em>
              </h1>
              <p className="mt-1.5 font-mono text-[11px] text-muted" aria-live="polite">
                {loading ? "Actualizando…" : `${data.total.toLocaleString("es-AR")} actividades`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFavoritesOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-muted transition-colors hover:text-fg"
            >
              <svg viewBox="0 0 24 24" fill={favorites.length ? "#f5b84a" : "none"} stroke={favorites.length ? "#f5b84a" : "currentColor"} strokeWidth="1.8" className="h-3.5 w-3.5">
                <path d="M6 3h12v18l-6-4-6 4V3Z" />
              </svg>
              <span className="font-mono">{favorites.length}</span>
            </button>
          </div>

          <FilterBar
            filters={filters}
            activeZone={activeZone}
            onChange={setFilters}
            onSelectZone={selectZone}
            onFocusSearch={() => setSheet((s) => (s === "peek" ? "half" : s))}
          />
        </header>

        {/* Sort tabs */}
        <div className="flex shrink-0 items-center gap-4 border-y border-line px-4 py-2.5 text-xs">
          {(
            [
              ["upcoming", "Próximos"],
              ["free", "Gratis primero"],
              ...(userLocation ? ([["nearest", "Cerca"]] as const) : []),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSortMode(id)}
              className={`font-medium transition-colors ${sortMode === id ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
              {sortMode === id && <span className="mt-1 block h-px bg-accent" />}
            </button>
          ))}
        </div>

        {/* List */}
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {events.length === 0 && !loading ? (
            <li className="px-6 py-12 text-center">
              <p className="font-display text-xl">Nada por acá.</p>
              <p className="mt-1 text-xs text-muted">Probá con menos filtros.</p>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-4 rounded-full bg-fg px-4 py-2 text-xs font-semibold text-ink"
              >
                Ver todo
              </button>
            </li>
          ) : (
            events.map((ev) => {
              const cat = categoryById[ev.category] ?? categoryById.arte;
              const dist = userLocation ? distanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng) : null;
              const on = selected?.id === ev.id;
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredId(ev.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => selectEvent(ev)}
                    className={`group flex w-full gap-3 px-4 py-3.5 text-left transition-colors ${on ? "bg-accent/10" : "hover:bg-white/[0.03]"}`}
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: cat.color }} />
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 text-sm font-medium leading-snug ${on ? "text-accent" : "text-fg"}`}>
                        {ev.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {ev.venueName}
                        {ev.barrio ? ` · ${ev.barrio}` : ""}
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="truncate text-muted">
                          {formatEventDate(ev.startsAt)}
                          {dist != null ? ` · ${dist.toFixed(1)} km` : ""}
                        </span>
                        <span className={`shrink-0 ${ev.isFree ? "text-emerald-400" : "text-fg/80"}`}>{ev.priceLabel}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
          <li className="px-4 py-5 text-center">
            <Link href="/acerca" className="font-mono text-[11px] text-muted hover:text-fg">
              Fuentes y metodología →
            </Link>
          </li>
        </ul>
      </section>

      <EventSheet
        event={selected}
        siblingEvents={siblings}
        isFavorite={selected ? isFavorite(selected.id) : false}
        userLocation={userLocation}
        onClose={() => setSelected(null)}
        onSelectSibling={(ev) => setSelected(ev)}
        onToggleFavorite={toggleFavorite}
      />

      <FavoritesDrawer
        open={favoritesOpen}
        items={favorites}
        onClose={() => setFavoritesOpen(false)}
        onSelect={selectFavorite}
        onRemove={toggleFavorite}
      />
    </main>
  );
}

function ToolButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`pointer-events-auto flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border px-3 text-xs font-medium shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-colors ${
        active ? "border-sky-400/60 bg-sky-400/15 text-sky-300" : "border-line bg-panel/90 text-fg hover:bg-raised"
      }`}
    >
      {children}
    </button>
  );
}
