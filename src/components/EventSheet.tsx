"use client";

import { useEffect, useState } from "react";
import { categoryById, SOURCE_LABELS } from "@/lib/domain";
import type { FavoriteItem } from "@/lib/favorites";
import { distanceKm, formatEventDate, formatEventLongDate } from "@/lib/format";
import type { MapEventProperties } from "./MapView";

interface EventDetail extends MapEventProperties {
  sources?: Array<{ source: string; url: string }>;
  upcomingSchedule?: Array<{ id: number; startsAt: string }>;
}

interface EventSheetProps {
  event: MapEventProperties | null;
  isFavorite: boolean;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onToggleFavorite: (item: FavoriteItem) => void;
}

export function EventSheet({
  event,
  isFavorite,
  userLocation,
  onClose,
  onToggleFavorite,
}: EventSheetProps) {
  const [detail, setDetail] = useState<EventDetail | null>(null);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    fetch(`/api/events/${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EventDetail | null) => {
        if (!cancelled && d) setDetail(d);
      })
      .catch(() => {
        // Keep base properties on error
      });
    return () => {
      cancelled = true;
    };
  }, [event]);

  if (!event) return null;
  const current = detail && detail.id === event.id ? detail : event;
  const cat = categoryById[current.category] ?? categoryById.arte;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${current.lat},${current.lng}&travelmode=transit`;
  const dist =
    userLocation != null
      ? distanceKm(userLocation.lat, userLocation.lng, current.lat, current.lng)
      : null;

  return (
    <aside
      aria-label="Ficha del evento"
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[82vh] flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-44 sm:max-h-[calc(100vh-12rem)] sm:w-[400px] sm:rounded-3xl dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header image or colour banner */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
        {current.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt={current.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-5xl"
            style={{ backgroundColor: `${cat.color}22` }}
          >
            {cat.emoji}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ficha"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white backdrop-blur hover:bg-black/80"
        >
          ✕
        </button>

        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow"
            style={{ backgroundColor: cat.color }}
          >
            {cat.emoji} {cat.label}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold shadow ${
              current.isFree
                ? "bg-emerald-500 text-white"
                : "bg-white/95 text-slate-900"
            }`}
          >
            {current.priceLabel}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold leading-snug text-slate-900 dark:text-white">
            {current.title}
          </h2>
          <button
            type="button"
            onClick={() =>
              onToggleFavorite({
                id: current.id,
                title: current.title,
                category: current.category,
                priceLabel: current.priceLabel,
                startsAt: current.startsAt,
                venueName: current.venueName,
                barrio: current.barrio,
                url: current.url,
                lat: current.lat,
                lng: current.lng,
              })
            }
            aria-label={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              isFavorite
                ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {isFavorite ? "❤️ Guardado" : "🤍 Guardar"}
          </button>
        </div>

        {/* Date & Venue */}
        <div className="space-y-1.5 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
          <div className="flex items-center gap-2 font-medium">
            <span>🗓️</span>
            <span className="capitalize">{formatEventLongDate(current.startsAt)} hs</span>
          </div>
          <div className="flex items-start gap-2">
            <span>📍</span>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {current.venueName}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {[current.address, current.barrio, "CABA"].filter(Boolean).join(" · ")}
                {dist != null && ` · a ${dist.toFixed(1)} km`}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming schedule pills when show repeats */}
        {detail?.upcomingSchedule && detail.upcomingSchedule.length > 1 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Próximas funciones ({detail.upcomingSchedule.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detail.upcomingSchedule.slice(0, 6).map((slot) => (
                <span
                  key={slot.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {formatEventDate(slot.startsAt)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {current.description && (
          <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {current.description}
          </p>
        )}

        {/* Source attribution */}
        <div className="pt-1 text-[11px] text-slate-400">
          Fuente: {SOURCE_LABELS[current.source] ?? current.source}
        </div>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <span>🧭</span>
          <span>Cómo llegar</span>
        </a>
        <a
          href={current.ticketsUrl || current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950"
        >
          <span>🎟️</span>
          <span>Web oficial / Entradas</span>
        </a>
      </div>
    </aside>
  );
}
