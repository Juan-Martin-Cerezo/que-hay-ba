"use client";

import { useEffect, useState } from "react";
import { categoryById, SOURCE_LABELS } from "@/lib/domain";
import type { FavoriteItem } from "@/lib/favorites";
import { distanceKm, formatEventDate, formatEventLongDate } from "@/lib/format";
import type { MapEventProperties } from "./MapView";

interface EventDetail extends MapEventProperties {
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

function calendarUrl(ev: MapEventProperties): string {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : new Date(start.getTime() + 2 * 3600_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${ev.description ? `${ev.description.slice(0, 300)}\n\n` : ""}${ev.url}`,
    location: [ev.venueName, ev.address, ev.barrio, "Buenos Aires"].filter(Boolean).join(", "),
  })}`;
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
  const [failedImgUrl, setFailedImgUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    fetch(`/api/events/${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EventDetail | null) => !cancelled && d && setDetail(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [event]);

  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  if (!event) return null;
  const ev = detail && detail.id === event.id ? detail : event;
  const imgFailed = Boolean(ev.imageUrl && failedImgUrl === ev.imageUrl);
  const copied = copiedId === ev.id;
  const cat = categoryById[ev.category] ?? categoryById.arte;
  const dist = userLocation ? distanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng) : null;
  const hasNumericPrice = ev.priceMin != null && ev.priceMin > 0;

  const share = async () => {
    const text = `${ev.title} — ${ev.venueName}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: ev.title, text, url: ev.url });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${ev.url}`);
      setCopiedId(ev.id);
      setTimeout(() => setCopiedId((prev) => (prev === ev.id ? null : prev)), 2000);
    } catch {
      /* ignore */
    }
  };

  const fav: FavoriteItem = {
    id: ev.id,
    title: ev.title,
    category: ev.category,
    priceLabel: ev.priceLabel,
    startsAt: ev.startsAt,
    venueName: ev.venueName,
    barrio: ev.barrio,
    url: ev.url,
    lat: ev.lat,
    lng: ev.lng,
  };

  return (
    <aside
      role="dialog"
      aria-label={ev.title}
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl border-t border-line bg-panel shadow-[0_-20px_60px_-12px_rgba(0,0,0,0.92)] sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-[360px] sm:rounded-3xl sm:border lg:w-[400px]"
    >
      {/* Media */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-raised">
        {ev.imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ev.imageUrl}
            alt={ev.title}
            onError={() => setFailedImgUrl(ev.imageUrl)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-end p-5"
            style={{
              background: `radial-gradient(120% 90% at 0% 0%, ${cat.color}55, transparent 60%), #18181b`,
            }}
          >
            <span className="font-display text-3xl sm:text-4xl italic text-white/80">
              {cat.label}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-black/35" />
        <div className="absolute inset-x-3 top-3 flex justify-between">
          <button
            type="button"
            onClick={share}
            className="flex h-11 cursor-pointer items-center rounded-full bg-black/60 px-4 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/80 active:scale-95"
          >
            {copied ? "✓ Enlace copiado" : "Compartir"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/60 text-sm text-white backdrop-blur-md transition hover:bg-black/80 active:scale-95"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
          <span>{cat.shortLabel}</span>
          <span>·</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              ev.isFree
                ? "bg-emerald-400/15 text-emerald-400"
                : hasNumericPrice
                  ? "bg-accent/15 text-accent"
                  : "bg-white/5 text-muted"
            }`}
          >
            {ev.priceLabel}
          </span>
        </div>

        <h2 className="mt-2.5 font-display text-[26px] sm:text-[28px] leading-[1.1] tracking-tight text-fg">
          {ev.title}
        </h2>

        {/* Facts */}
        <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="sr-only">Fecha</dt>
            <dd className="capitalize text-fg">{formatEventLongDate(ev.startsAt)} hs</dd>
            <a
              href={calendarUrl(ev)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-accent/30 bg-accent/10 px-2.5 font-mono text-[11px] font-medium text-accent hover:bg-accent/20"
            >
              + Agendar
            </a>
          </div>
          <div className="py-3">
            <dt className="sr-only">Lugar</dt>
            <dd className="font-medium text-fg">{ev.venueName}</dd>
            <dd className="mt-0.5 text-xs text-muted">
              {[ev.address, ev.barrio].filter(Boolean).join(" · ")}
              {dist != null && <span className="font-mono"> · {dist.toFixed(1)} km</span>}
            </dd>
          </div>
        </dl>

        {/* Same venue */}
        {siblingEvents.length > 1 && (
          <section className="mt-5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              También en este lugar · {siblingEvents.length}
            </p>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {siblingEvents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSibling(s)}
                  className={`min-h-9 max-w-[220px] shrink-0 cursor-pointer truncate rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                    s.id === ev.id
                      ? "border-accent bg-accent/15 text-accent font-medium"
                      : "border-line text-muted hover:text-fg"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </section>
        )}

        {detail?.upcomingSchedule && detail.upcomingSchedule.length > 1 && (
          <section className="mt-5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Próximas funciones · {detail.upcomingSchedule.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detail.upcomingSchedule.slice(0, 8).map((s) => (
                <span
                  key={s.id}
                  className="rounded-lg border border-line bg-raised px-2.5 py-1 font-mono text-[11px] text-fg/85"
                >
                  {formatEventDate(s.startsAt)}
                </span>
              ))}
            </div>
          </section>
        )}

        {ev.description && (
          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-fg/80">
            {ev.description}
          </p>
        )}

        <p className="mt-6 font-mono text-[11px] text-muted">
          Fuente verificada: {SOURCE_LABELS[ev.source] ?? ev.source}
        </p>
      </div>

      {/* Actions */}
      <div className="grid shrink-0 grid-cols-[auto_1fr_1fr] gap-2 border-t border-line bg-panel p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => onToggleFavorite(fav)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Quitar de guardados" : "Guardar"}
          className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border transition-colors active:scale-95 ${
            isFavorite
              ? "border-accent bg-accent/15 text-accent"
              : "border-line text-muted hover:text-fg"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill={isFavorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path d="M6 3h12v18l-6-4-6 4V3Z" />
          </svg>
        </button>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}&travelmode=transit`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center rounded-xl border border-line text-sm font-medium text-fg transition hover:bg-raised active:scale-[0.98]"
        >
          Cómo llegar
        </a>
        <a
          href={ev.ticketsUrl || ev.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-ink transition hover:brightness-110 active:scale-[0.98]"
        >
          {ev.isFree ? "Ver actividad" : hasNumericPrice ? "Entradas" : "Consultar web"}
        </a>
      </div>
    </aside>
  );
}
