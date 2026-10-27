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
const SHEET_HEIGHT: Record<Sheet, string> = { peek: "168px", half: "52dvh", full: "82dvh" };
const NEXT_SHEET: Record<Sheet, Sheet> = { peek: "half", half: "full", full: "peek" };

export function ExploreClient() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<EventsGeoJSON>(EMPTY_GEOJSON);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>("en vivo");
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Perpetual live auto-refresh every 60s and whenever tab regains visibility.
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") setRefreshTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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
    fetch(`/api/events?${queryString}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
        return r.json();
      })
      .then((d: EventsGeoJSON) => {
        if (!ctrl.signal.aborted && d?.features) {
          setData(d);
          setLoadError(null);
          setLoadedKey(queryString);
          const now = new Date();
          setLastUpdated(
            now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
          );
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : "No se pudo cargar la cartelera");
        setLoadedKey(queryString);
      });
    return () => ctrl.abort();
  }, [queryString, refreshTick]);

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

  const sortHeader = (
    <div className="flex shrink-0 items-center justify-between border-y border-line px-4 py-2 text-xs">
      <div className="flex items-center gap-4">
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
            className={`relative py-0.5 font-medium transition-colors ${
              sortMode === id ? "text-accent" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            loadError ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
          }`}
        />
        {loading
          ? "Sincronizando…"
          : loadError
            ? "Sin datos del servidor · reintentando"
            : `${data.total.toLocaleString("es-AR")} · ${lastUpdated}`}
      </span>
    </div>
  );

  const renderEventRows = () => (
    <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
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
                className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  on ? "bg-accent/12" : "hover:bg-white/[0.03]"
                }`}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs"
                  style={{
                    background: `${cat.color}1f`,
                    borderColor: `${cat.color}55`,
                  }}
                >
                  {cat.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`line-clamp-1 text-sm font-medium leading-snug ${on ? "text-accent" : "text-fg"}`}>
                    {ev.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {ev.venueName}
                    {ev.barrio ? ` · ${ev.barrio}` : ""}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="truncate text-muted">
                      {formatEventDate(ev.startsAt)}
                      {dist != null ? ` · ${dist.toFixed(1)} km` : ""}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.2 text-[10.5px] font-semibold ${
                        ev.isFree ? "bg-emerald-400/15 text-emerald-400" : "text-fg/80"
                      }`}
                    >
                      {ev.priceLabel}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })
      )}
      <li className="px-4 py-4 text-center">
        <Link href="/acerca" className="font-mono text-[11px] text-muted hover:text-fg">
          Fuentes y metodología →
        </Link>
      </li>
    </ul>
  );

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

      {/* Floating map tools — top right on desktop, bottom-right above sheet on mobile */}
      <div className="pointer-events-none absolute right-3 top-3 z-10 hidden gap-2 md:flex">
        <ToolButton onClick={cycleTheme} label={`Mapa: ${themeLabel}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="m12 3 9 5-9 5-9-5 9-5Z" />
            <path d="m3 13 9 5 9-5" />
          </svg>
          <span>{themeLabel}</span>
        </ToolButton>
        <ToolButton onClick={locate} label="Mi ubicación" active={Boolean(userLocation)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 ${locating ? "animate-spin" : ""}`}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </ToolButton>
      </div>

      {/* MOBILE (< 768px): Top Floating Search & Category Bar */}
      <div className="fixed inset-x-2.5 top-[max(0.5rem,env(safe-area-inset-top))] z-20 rounded-2xl border border-line bg-panel/95 p-2.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.85)] backdrop-blur-xl md:hidden">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-xl leading-none tracking-tight">
              Qué hay <em className="text-accent">BA</em>
            </h1>
            <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {data.total}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleTheme}
              className="flex h-7 items-center gap-1 rounded-full border border-line bg-raised px-2.5 text-[11px] text-muted hover:text-fg"
            >
              {themeLabel}
            </button>
            <button
              type="button"
              onClick={locate}
              aria-label="Mi ubicación"
              className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                userLocation ? "border-sky-400/60 bg-sky-400/15 text-sky-300" : "border-line bg-raised text-muted"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setFavoritesOpen(true)}
              className="flex h-7 items-center gap-1 rounded-full border border-line bg-raised px-2.5 font-mono text-[11px] text-muted"
            >
              ★ {favorites.length}
            </button>
          </div>
        </div>
        <FilterBar
          filters={filters}
          activeZone={activeZone}
          onChange={setFilters}
          onSelectZone={selectZone}
        />
      </div>

      {/* MOBILE (< 768px): Bottom Sheet strictly for the Event List */}
      <section
        aria-label="Actividades en móvil"
        style={{ height: SHEET_HEIGHT[sheet] }}
        className="fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl border-t border-line bg-panel/95 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-[height] duration-300 ease-out md:hidden"
      >
        <button
          type="button"
          onClick={() => setSheet((s) => NEXT_SHEET[s])}
          aria-label={sheet === "full" ? "Contraer listado" : "Expandir listado"}
          className="flex w-full shrink-0 items-center justify-center gap-2 py-2"
        >
          <span className="h-1 w-9 rounded-full bg-white/25" />
        </button>
        {sortHeader}
        {renderEventRows()}
      </section>

      {/* DESKTOP & TABLET (≥ 768px): Fixed Left Column Sidebar */}
      <aside
        aria-label="Explorar actividades"
        className="hidden md:fixed md:bottom-3 md:left-3 md:top-3 md:z-20 md:flex md:w-[392px] md:flex-col md:overflow-hidden md:rounded-3xl md:border md:border-line md:bg-panel/95 md:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] md:backdrop-blur-xl lg:w-[408px]"
      >
        <header className="shrink-0 space-y-3 p-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-[26px] leading-none tracking-tight">
                Qué hay <em className="text-accent">BA</em>
              </h1>
              <p className="mt-1 font-mono text-[11px] text-muted">
                Cartelera cultural y recreativa en vivo
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRefreshTick((t) => t + 1)}
                title="Actualizar cartelera ahora"
                aria-label="Actualizar cartelera ahora"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-white/20 hover:text-fg"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-3.5 w-3.5 ${loading ? "animate-spin text-accent" : ""}`}>
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setFavoritesOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-muted transition-colors hover:border-white/20 hover:text-fg"
              >
                <svg viewBox="0 0 24 24" fill={favorites.length ? "#f5b84a" : "none"} stroke={favorites.length ? "#f5b84a" : "currentColor"} strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path d="M6 3h12v18l-6-4-6 4V3Z" />
                </svg>
                <span className="font-mono">{favorites.length}</span>
              </button>
            </div>
          </div>

          <FilterBar
            filters={filters}
            activeZone={activeZone}
            onChange={setFilters}
            onSelectZone={selectZone}
          />
        </header>

        {sortHeader}
        {renderEventRows()}
      </aside>

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
      className={`pointer-events-auto flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border px-3.5 text-xs font-medium shadow-[0_8px_24px_-8px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-colors ${
        active ? "border-sky-400/60 bg-sky-400/15 text-sky-300" : "border-line bg-panel/95 text-fg hover:bg-raised"
      }`}
    >
      {children}
    </button>
  );
}
