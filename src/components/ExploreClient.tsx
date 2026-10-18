"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { categoryById } from "@/lib/domain";
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
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    ts: number;
  } | null>(null);

  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 240);
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
    setFlyTarget({ lat: ev.lat, lng: ev.lng, zoom: 15.5, ts: Date.now() });
  }, []);

  const handleLocateUser = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
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
    if (!userLocation) return list.slice(0, 80);
    return [...list]
      .sort(
        (a, b) =>
          distanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      )
      .slice(0, 80);
  }, [data.features, userLocation]);

  const handleSelectFavorite = useCallback(
    (item: FavoriteItem) => {
      setFavoritesOpen(false);
      const existing = data.features.find((f) => f.properties.id === item.id)?.properties;
      if (existing) {
        handleSelectEvent(existing);
      } else {
        setFlyTarget({ lat: item.lat, lng: item.lng, zoom: 15.5, ts: Date.now() });
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

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <FilterBar
        filters={filters}
        total={data.total}
        loading={loading}
        favoritesCount={favorites.length}
        locating={locating}
        hasUserLocation={Boolean(userLocation)}
        onChange={setFilters}
        onOpenFavorites={() => setFavoritesOpen(true)}
        onLocateUser={handleLocateUser}
      />

      <MapView
        data={data}
        selectedId={selected?.id ?? null}
        userLocation={userLocation}
        flyTarget={flyTarget}
        onSelectEvent={handleSelectEvent}
      />

      {/* Bottom-left controls: toggle list view + about link */}
      <div className="pointer-events-none absolute bottom-4 left-3 z-20 flex items-center gap-2 sm:left-4">
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
        >
          <span>{listOpen ? "🗺️ Ocultar lista" : "📋 Ver listado"}</span>
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white dark:bg-sky-500 dark:text-slate-950">
            {data.total}
          </span>
        </button>

        <Link
          href="/acerca"
          className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-lg backdrop-blur hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300"
        >
          Fuentes
        </Link>
      </div>

      {/* Collapsible left event list drawer */}
      {listOpen && (
        <section
          aria-label="Listado de actividades"
          className="fixed bottom-16 left-3 right-3 z-20 flex max-h-[56vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur sm:bottom-16 sm:left-4 sm:right-auto sm:top-44 sm:max-h-none sm:w-[360px] dark:border-slate-800 dark:bg-slate-900/95"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
            <span>
              {userLocation ? "Actividades más cercanas" : "Próximas actividades"}
            </span>
            <button
              type="button"
              onClick={() => setListOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {sortedEvents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No encontramos eventos con esos filtros. Probá ampliar la búsqueda.
              </div>
            ) : (
              sortedEvents.map((ev) => {
                const cat = categoryById[ev.category] ?? categoryById.arte;
                const dist =
                  userLocation != null
                    ? distanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng)
                    : null;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => handleSelectEvent(ev)}
                    className={`flex w-full items-start gap-3 p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      selected?.id === ev.id ? "bg-sky-50/70 dark:bg-sky-950/40" : ""
                    }`}
                  >
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                        <span className="truncate">{formatEventDate(ev.startsAt)}</span>
                        <span
                          className={`shrink-0 font-semibold ${
                            ev.isFree
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {ev.priceLabel}
                        </span>
                      </div>
                      <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {ev.title}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
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

      <EventSheet
        event={selected}
        isFavorite={selected ? isFavorite(selected.id) : false}
        userLocation={userLocation}
        onClose={() => setSelected(null)}
        onToggleFavorite={toggleFavorite}
      />

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
