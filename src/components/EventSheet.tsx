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
  siblingEvents: MapEventProperties[];
  isFavorite: boolean;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onSelectSibling: (ev: MapEventProperties) => void;
  onToggleFavorite: (item: FavoriteItem) => void;
}

function buildGoogleCalendarUrl(ev: MapEventProperties): string {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : new Date(start.getTime() + 2 * 3600_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${ev.description ? `${ev.description.slice(0, 300)}\n\n` : ""}Más info: ${ev.url}`,
    location: [ev.venueName, ev.address, ev.barrio, "Buenos Aires"].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function EventSheet({
  event,
  siblingEvents,
  isFavorite,
  userLocation,
  onClose,
  onSelectSibling,
  onToggleFavorite,
}: EventSheetProps) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setCopied(false);
    if (!event) return;
    let cancelled = false;
    fetch(`/api/events/${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EventDetail | null) => {
        if (!cancelled && d) setDetail(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [event]);

  if (!event) return null;
  const current = detail && detail.id === event.id ? detail : event;
  const cat = categoryById[current.category] ?? categoryById.arte;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${current.lat},${current.lng}&travelmode=transit`;
  const calendarUrl = buildGoogleCalendarUrl(current);
  const dist =
    userLocation != null
      ? distanceKm(userLocation.lat, userLocation.lng, current.lat, current.lng)
      : null;

  const handleShare = async () => {
    const shareText = `${current.title} en ${current.venueName} (${current.priceLabel})`;
    const shareUrl = current.url || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: current.title, text: shareText, url: shareUrl });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} — ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <aside
      aria-label="Ficha del evento"
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[84dvh] flex-col overflow-hidden rounded-t-3xl border border-slate-900/15 bg-[#fcfaf5]/98 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-29 sm:max-h-[calc(100dvh-8.5rem)] sm:w-[415px] sm:rounded-3xl dark:border-white/15 dark:bg-[#0b0f19]/98"
    >
      {/* Mobile drag handle */}
      <div className="flex justify-center pb-1 pt-2 sm:hidden">
        <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
      </div>

      {/* Hero Banner */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-slate-950 sm:h-48">
        {current.imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt={current.title}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1.5"
            style={{
              background: `radial-gradient(circle at 25% 20%, ${cat.color}ee, #090d16 85%)`,
            }}
          >
            <span className="text-5xl drop-shadow">{cat.emoji}</span>
            <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-widest text-white/80">
              {cat.label}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/30 to-transparent" />

        {/* Top floating controls */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="font-mono-tabular rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/95 backdrop-blur-md">
            {SOURCE_LABELS[current.source] ?? current.source}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartir evento"
              className="flex h-8 items-center gap-1 rounded-full border border-white/15 bg-black/60 px-3 text-xs font-bold text-white backdrop-blur-md transition hover:bg-black/80"
            >
              <span>{copied ? "✓ Copiado" : "↗ Compartir"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ficha"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/60 text-sm font-bold text-white backdrop-blur-md transition hover:bg-black/80"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Bottom badges on hero */}
        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1 text-xs font-bold text-white shadow-lg"
            style={{ backgroundColor: cat.color }}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </span>
          <span
            className={`font-mono-tabular rounded-full px-3 py-1 text-xs font-extrabold shadow-lg ${
              current.isFree
                ? "bg-emerald-500 text-white"
                : "bg-[#fcfaf5] text-slate-950"
            }`}
          >
            {current.priceLabel}
          </span>
        </div>
      </div>

      {/* Co-located experiences switcher ("en la misma ubicación") */}
      {siblingEvents.length > 1 && (
        <div className="border-b border-slate-900/10 bg-amber-500/10 px-3.5 py-2 dark:border-white/10 dark:bg-amber-500/15">
          <p className="font-mono-tabular mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300">
            📍 {siblingEvents.length} experiencias en esta misma ubicación ({current.venueName})
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {siblingEvents.map((sib) => {
              const sibCat = categoryById[sib.category] ?? categoryById.arte;
              const active = sib.id === current.id;
              return (
                <button
                  key={sib.id}
                  type="button"
                  onClick={() => onSelectSibling(sib)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white dark:border-rose-500 dark:bg-rose-600"
                      : "border-slate-900/15 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  <span>{sibCat.emoji}</span>
                  <span className="max-w-[140px] truncate">{sib.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable Body */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold leading-snug text-slate-950 sm:text-xl dark:text-white">
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
            className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              isFavorite
                ? "border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                : "border-slate-900/12 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/12 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {isFavorite ? "❤️ En mi agenda" : "🤍 Guardar"}
          </button>
        </div>

        {/* Editorial Ticket Stub: Date, Time & Venue */}
        <div className="space-y-2.5 rounded-2xl border border-dashed border-slate-900/20 bg-white/80 p-3.5 text-xs text-slate-700 dark:border-white/20 dark:bg-slate-900/70 dark:text-slate-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                🗓️
              </span>
              <span className="font-mono-tabular capitalize">
                {formatEventLongDate(current.startsAt)} hs
              </span>
            </div>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-slate-900/15 bg-[#fcfaf5] px-2.5 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-200"
            >
              + Google Calendar
            </a>
          </div>

          <div className="flex items-start gap-2 border-t border-dashed border-slate-900/15 pt-2.5 dark:border-white/15">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
              📍
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-950 dark:text-white">{current.venueName}</div>
              <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                {[current.address, current.barrio, "CABA"].filter(Boolean).join(" · ")}
                {dist != null && (
                  <span className="font-mono-tabular ml-1.5 inline-block rounded-md bg-emerald-500/15 px-1.5 py-0.2 font-bold text-emerald-700 dark:text-emerald-300">
                    a {dist.toFixed(1)} km
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming schedule pills when show repeats */}
        {detail?.upcomingSchedule && detail.upcomingSchedule.length > 1 && (
          <div>
            <p className="font-mono-tabular mb-1.5 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
              Próximas funciones ({detail.upcomingSchedule.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detail.upcomingSchedule.slice(0, 8).map((slot) => (
                <span
                  key={slot.id}
                  className="font-mono-tabular rounded-lg border border-slate-900/10 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                >
                  {formatEventDate(slot.startsAt)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Synopsis / Description */}
        {current.description && (
          <div className="space-y-1">
            <p className="font-mono-tabular text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
              Reseña y detalles
            </p>
            <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {current.description}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="grid grid-cols-2 gap-2.5 border-t border-slate-900/12 bg-white/90 p-3.5 dark:border-white/12 dark:bg-slate-900/90">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-900/15 bg-[#fcfaf5] px-3 py-2.5 text-xs font-extrabold text-slate-900 shadow-xs transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100"
        >
          <span>🧭</span>
          <span>Cómo llegar</span>
        </a>
        <a
          href={current.ticketsUrl || current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500"
        >
          <span>🎟️</span>
          <span>Entradas / Web oficial</span>
        </a>
      </div>
    </aside>
  );
}
