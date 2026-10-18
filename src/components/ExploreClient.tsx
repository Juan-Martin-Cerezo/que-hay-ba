"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CABA_ZONES, categoryById, type MapThemeId } from "@/lib/domain";
import { useFavorites, type FavoriteItem } from "@/lib/favorites";
import { distanceKm, formatEventDate } from "@/lib/format";
import { EventSheet } from "./EventSheet";
import { FavoritesDrawer } from "./FavoritesDrawer";
import { FilterBar, type FilterState } from "./FilterBar";
import { MapView, type EventsGeoJSON, type MapEventProperties } from "./MapView";

const EMPTY_GEOJSON: EventsGeoJSON = {
  type: "FeatureCollection",
  total: 0,
  features: [],
};

type SortMode = "upcoming" | "free" | "nearest";

export function ExploreClient() {
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    when: "",
    price: "",
    categories: [],
  });
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<EventsGeoJSON>(EMPTY_GEOJSON);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapEventProperties | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("upcoming");
  const [activeZone, setActiveZone] = useState<string>("all");
  const [mapTheme, setMapTheme] = useState<MapThemeId>("voyager");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    ts: number;
  } | null>(null);

  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  // Open discovery sidebar by default on desktop screens
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setListOpen(true);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 220);
    return () => clearTimeout(t);
  }, [filters.q]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (filters.when) params.set("when", filters.when);
    if (filters.price) params.set("price", filters.price);
    if (filters.categories.length > 0) params.set("cat", filters.categories.join(","));
    return params.toString();
  }, [debouncedQ, filters.when, filters.price, filters.categories]);

  const loading = loadedKey !== queryString;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/events?${queryString}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: EventsGeoJSON) => {
        if (!controller.signal.aborted && d?.features) {
          setData(d);
          setLoadedKey(queryString);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadedKey(queryString);
      });

    return () => controller.abort();
  }, [queryString]);

  const handleSelectEvent = useCallback((ev: MapEventProperties) => {
    setSelected(ev);
    setFlyTarget({ lat: ev.lat, lng: ev.lng, zoom: 15.8, ts: Date.now() });
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setListOpen(false);
    }
  }, []);

  const handleSelectZone = useCallback((zone: (typeof CABA_ZONES)[number]) => {
    setActiveZone(zone.id);
    setFlyTarget({ lat: zone.lat, lng: zone.lng, zoom: zone.zoom, ts: Date.now() });
  }, []);

  const handleLocateUser = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setSortMode("nearest");
        setFlyTarget({ lat: loc.lat, lng: loc.lng, zoom: 14.5, ts: Date.now() });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const sortedEvents = useMemo(() => {
    const list = data.features.map((f) => f.properties);
    if (sortMode === "nearest" && userLocation) {
      return [...list]
        .sort(
          (a, b) =>
            distanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
            distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
        )
        .slice(0, 100);
    }
    if (sortMode === "free") {
      return [...list]
        .sort((a, b) => Number(b.isFree) - Number(a.isFree))
        .slice(0, 100);
    }
    return list.slice(0, 100);
  }, [data.features, sortMode, userLocation]);

  const handleSelectFavorite = useCallback(
    (item: FavoriteItem) => {
      setFavoritesOpen(false);
      const existing = data.features.find((f) => f.properties.id === item.id)?.properties;
      if (existing) {
        handleSelectEvent(existing);
      } else {
        setFlyTarget({ lat: item.lat, lng: item.lng, zoom: 15.8, ts: Date.now() });
        fetch(`/api/events/${item.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((ev) => {
            if (ev) setSelected(ev);
          })
          .catch(() => {});
      }
    },
    [data.features, handleSelectEvent]
  );

  const cycleMapTheme = () => {
    const order: MapThemeId[] = ["voyager", "dark", "light", "osm"];
    const next = order[(order.indexOf(mapTheme) + 1) % order.length];
    setMapTheme(next);
  };

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-slate-200 select-none dark:bg-slate-950">
      {/* Interactive Full-Viewport Map */}
      <MapView
        data={data}
        selectedId={selected?.id ?? null}
        hoveredId={hoveredId}
        mapTheme={mapTheme}
        userLocation={userLocation}
        flyTarget={flyTarget}
        onSelectEvent={handleSelectEvent}
      />

      {/* Top Floating Search & Filter Command Bar */}
      <FilterBar
        filters={filters}
        total={data.total}
        loading={loading}
        favoritesCount={favorites.length}
        locating={locating}
        hasUserLocation={Boolean(userLocation)}
        activeZone={activeZone}
        mapTheme={mapTheme}
        onChange={setFilters}
        onSelectZone={handleSelectZone}
        onChangeTheme={setMapTheme}
        onOpenFavorites={() => setFavoritesOpen(true)}
        onLocateUser={handleLocateUser}
      />

      {/* Collapsible Discovery Sidebar (Desktop Left Panel / Mobile Bottom Sheet) */}
      {listOpen && (
        <section
          aria-label="Listado de actividades"
          className="fixed bottom-16 left-2.5 right-2.5 z-20 flex max-h-[58dvh] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-xl sm:bottom-16 sm:left-3.5 sm:right-auto sm:top-28 sm:max-h-none sm:w-[370px] dark:border-slate-800/90 dark:bg-slate-900/95"
        >
          {/* Quick Barrio Jump Strip inside panel */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200/70 bg-slate-50/70 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-slate-800/80 dark:bg-slate-800/40">
            {CABA_ZONES.map((z) => {
              const active = activeZone === z.id;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => handleSelectZone(z)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    active
                      ? "bg-sky-600 text-white shadow-xs"
                      : "bg-white/90 text-slate-600 hover:bg-white hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {z.label}
                </button>
              );
            })}
          </div>

          {/* Panel Header + Sort Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200/80 px-3.5 py-2 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSortMode("upcoming")}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  sortMode === "upcoming"
                    ? "bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Próximos
              </button>
              <button
                type="button"
                onClick={() => setSortMode("free")}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  sortMode === "free"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                Gratis primero
              </button>
              {userLocation && (
                <button
                  type="button"
                  onClick={() => setSortMode("nearest")}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                    sortMode === "nearest"
                      ? "bg-sky-600 text-white"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  Cerca mío
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setListOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Cerrar listado"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Event Cards */}
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800/70">
            {sortedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <span className="text-2xl">🔍</span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  No encontramos actividades con esos filtros
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setFilters({ q: "", when: "", price: "", categories: [] })
                  }
                  className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500"
                >
                  Ver todas las actividades
                </button>
              </div>
            ) : (
              sortedEvents.map((ev) => {
                const cat = categoryById[ev.category] ?? categoryById.arte;
                const dist =
                  userLocation != null
                    ? distanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng)
                    : null;
                const isSelected = selected?.id === ev.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onMouseEnter={() => setHoveredId(ev.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleSelectEvent(ev)}
                    className={`group flex w-full items-start gap-3 p-3 text-left transition ${
                      isSelected
                        ? "bg-sky-50/90 dark:bg-sky-950/50"
                        : "hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm text-white shadow-sm transition group-hover:scale-105"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span className="truncate capitalize">
                          {formatEventDate(ev.startsAt)}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.2 text-[10px] font-extrabold ${
                            ev.isFree
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {ev.priceLabel}
                        </span>
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-xs font-extrabold text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
                        {ev.title}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {ev.venueName}
                        {ev.barrio ? ` · ${ev.barrio}` : ""}
                        {dist != null ? ` · ${dist.toFixed(1)} km` : ""}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Bottom Floating Control Dock */}
      <div className="pointer-events-none absolute bottom-3.5 left-2.5 right-14 z-20 flex flex-wrap items-center gap-2 sm:left-3.5">
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-4 py-2 text-xs font-extrabold text-slate-900 shadow-xl backdrop-blur-xl transition hover:scale-[1.02] hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-white"
        >
          <span>{listOpen ? "🗺️ Ocultar lista" : "📋 Explorar lista"}</span>
          <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
            {data.total}
          </span>
        </button>

        {/* Quick 1-Click Map Style Toggle */}
        <button
          type="button"
          onClick={cycleMapTheme}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur-xl transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
          title="Cambiar estilo visual del mapa"
        >
          <span>🎨</span>
          <span>
            {mapTheme === "voyager"
              ? "Mapa: Color"
              : mapTheme === "dark"
                ? "Mapa: Nocturno"
                : mapTheme === "light"
                  ? "Mapa: Claro"
                  : "Mapa: Callejero"}
          </span>
        </button>

        {/* Re-center CABA button */}
        <button
          type="button"
          onClick={() => handleSelectZone(CABA_ZONES[0])}
          className="pointer-events-auto hidden items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur-xl transition hover:bg-white sm:flex dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
          title="Ver toda la Ciudad de Buenos Aires"
        >
          <span>🎯</span>
          <span>Toda CABA</span>
        </button>

        <Link
          href="/acerca"
          className="pointer-events-auto rounded-full border border-slate-200/90 bg-white/95 px-3 py-2 text-xs font-bold text-slate-600 shadow-xl backdrop-blur-xl transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300"
        >
          Fuentes
        </Link>
      </div>

      {/* Selected Event Sheet */}
      <EventSheet
        event={selected}
        isFavorite={selected ? isFavorite(selected.id) : false}
        userLocation={userLocation}
        onClose={() => setSelected(null)}
        onToggleFavorite={toggleFavorite}
      />

      {/* Saved Favourites Drawer */}
      <FavoritesDrawer
        open={favoritesOpen}
        items={favorites}
        onClose={() => setFavoritesOpen(false)}
        onSelect={handleSelectFavorite}
        onRemove={toggleFavorite}
      />
    </main>
  );
}
