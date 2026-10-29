"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { categoryById, type CategoryId, type MapThemeId } from "@/lib/domain";
import { formatEventDate } from "@/lib/format";

export interface MapEventProperties {
  id: number;
  groupKey: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  url: string;
  ticketsUrl: string;
  source: string;
  category: CategoryId;
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  priceLabel: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  address: string | null;
  barrio: string | null;
  lat: number;
  lng: number;
}

export interface EventsGeoJSON {
  type: "FeatureCollection";
  total: number;
  features: Array<{
    type: "Feature";
    id: number;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: MapEventProperties;
  }>;
}

interface VenueGroup {
  key: string;
  lat: number;
  lng: number;
  venueName: string;
  events: MapEventProperties[];
}

interface MapViewProps {
  data: EventsGeoJSON;
  selectedId: number | null;
  hoveredId: number | null;
  mapTheme: MapThemeId;
  userLocation: { lat: number; lng: number } | null;
  flyTarget: { lat: number; lng: number; zoom?: number; ts: number } | null;
  onSelectEvent: (ev: MapEventProperties) => void;
}

const RASTERS: Record<
  MapThemeId,
  { tiles: string[]; scheme?: "tms"; maxzoom: number; attribution: string }
> = {
  dark: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    maxzoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  osm: {
    tiles: [
      "https://servicios.usig.buenosaires.gob.ar/mapcache/tms/1.0.0/amba_con_transporte_3857@GoogleMapsCompatible/{z}/{x}/{y}.png",
    ],
    scheme: "tms",
    maxzoom: 18,
    attribution: "© USIG · GCBA",
  },
  voyager: {
    tiles: [
      "https://servicios.usig.buenosaires.gob.ar/mapcache/tms/1.0.0/amba_con_transporte_3857@GoogleMapsCompatible/{z}/{x}/{y}.png",
    ],
    scheme: "tms",
    maxzoom: 18,
    attribution: "© USIG · GCBA",
  },
  light: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    maxzoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
};

function buildStyle(theme: MapThemeId): StyleSpecification {
  const ids = Object.keys(RASTERS) as MapThemeId[];
  return {
    version: 8,
    sources: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          type: "raster",
          tileSize: 256,
          tiles: RASTERS[id].tiles,
          maxzoom: RASTERS[id].maxzoom,
          ...(RASTERS[id].scheme ? { scheme: RASTERS[id].scheme } : {}),
          attribution: RASTERS[id].attribution,
        },
      ])
    ) as StyleSpecification["sources"],
    layers: [
      {
        id: "bg-obsidian",
        type: "background",
        paint: { "background-color": "#09090b" },
      },
      ...ids.map((id) => ({
        id: `layer-${id}`,
        type: "raster" as const,
        source: id,
        minzoom: 0,
        maxzoom: 22,
        layout: { visibility: id === theme ? ("visible" as const) : ("none" as const) },
        paint: { "raster-fade-duration": 150 },
      })),
    ],
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trim()}…` : s;
}

/** Map padding so fly-to targets stay clear of the sidebar (md+) or mobile sheets. */
function panelPadding() {
  if (typeof window === "undefined") return { top: 24, right: 24, bottom: 24, left: 24 };
  if (window.innerWidth >= 1024) return { top: 32, right: 32, bottom: 32, left: 428 };
  if (window.innerWidth >= 768) return { top: 24, right: 24, bottom: 24, left: 380 };
  return { top: 148, right: 16, bottom: 210, left: 16 };
}

export function MapView({
  data,
  selectedId,
  hoveredId,
  mapTheme,
  userLocation,
  flyTarget,
  onSelectEvent,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const pinsRef = useRef<Marker[]>([]);
  const stackRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelectEvent);
  const [openStack, setOpenStack] = useState<string | null>(null);
  const [detailed, setDetailed] = useState(false);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectEvent;
  }, [onSelectEvent]);

  // Experiences sharing the same venue collapse into one globito.
  const groups = useMemo<VenueGroup[]>(() => {
    const byKey = new Map<string, VenueGroup>();
    for (const f of data.features) {
      const ev = f.properties;
      const key = `${ev.lat.toFixed(4)},${ev.lng.toFixed(4)}`;
      const g = byKey.get(key) ?? {
        key,
        lat: ev.lat,
        lng: ev.lng,
        venueName: ev.venueName,
        events: [],
      };
      g.events.push(ev);
      byKey.set(key, g);
    }
    return [...byKey.values()];
  }, [data.features]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: buildStyle(mapTheme),
        center: [-58.41, -34.6037],
        zoom: 12.6,
        minZoom: 10.5,
        maxZoom: 20,
        maxBounds: [
          [-58.62, -34.76],
          [-58.26, -34.49],
        ],
        attributionControl: false,
      });
    } catch {
      queueMicrotask(() => setWebglError(true));
      return;
    }

    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.setPadding(panelPadding());

    const syncZoom = () => setDetailed(map.getZoom() >= 13.6);
    map.on("load", () => {
      map.resize();
      syncZoom();
    });
    map.on("zoomend", syncZoom);
    map.on("click", () => setOpenStack(null));

    const ro = new ResizeObserver(() => {
      map.resize();
      map.setPadding(panelPadding());
    });
    ro.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      ro.disconnect();
      pinsRef.current.forEach((m) => m.remove());
      stackRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Globitos: HTML markers, one per venue — ALWAYS show every bubble across the map; full-text labels appear on zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visible = [...groups].sort((a, z) => {
      const act = (g: VenueGroup) =>
        g.events.some((e) => e.id === selectedId || e.id === hoveredId) ? 1 : 0;
      return act(a) - act(z) || a.events.length - z.events.length;
    });

    pinsRef.current.forEach((m) => m.remove());
    pinsRef.current = [];

    for (const g of visible) {
      const first = g.events[0];
      const n = g.events.length;
      const cat = categoryById[first.category] ?? categoryById.arte;
      const selected = g.events.some((e) => e.id === selectedId);
      const hovered = g.events.some((e) => e.id === hoveredId);
      const free = g.events.some((e) => e.isFree);

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", n > 1 ? `${n} experiencias en ${g.venueName}` : first.title);
      el.style.cssText = `background:none;border:0;padding:3px;cursor:pointer;z-index:${selected ? 30 : hovered ? 20 : n > 1 ? 2 : 1};`;

      if (!detailed && !selected && !hovered) {
        // Overview (all zoom-out levels): always-visible compact bubble for every venue/event.
        el.innerHTML = `
          <span class="qhba-pin-inner" style="display:flex;flex-direction:column;align-items:center">
            <span style="display:flex;align-items:center;gap:3.5px;height:26px;padding:0 ${n > 1 || free ? "8px" : "6px"};border-radius:999px;background:#111113;border:1.5px solid ${cat.color};color:#f4f4f6;box-shadow:0 5px 14px -3px rgba(0,0,0,.85);font:600 10.5px var(--ff-mono),monospace">
              <span style="font-size:12px;line-height:1">${cat.emoji}</span>
              ${n > 1 ? `<span>×${n}</span>` : ""}
              ${free && n === 1 ? `<span style="font-size:9px;color:#34d399">$0</span>` : ""}
            </span>
            <span style="width:2px;height:3.5px;background:${cat.color}"></span>
          </span>`;
      } else {
        // Zoomed-in (or selected/hovered): bubble with full text title / venue name.
        const bg = selected ? "#f5b84a" : "#111113";
        const fg = selected ? "#09090b" : "#f4f4f6";
        const border = selected ? "#f5b84a" : hovered ? "#f4f4f6" : `${cat.color}99`;
        const label = n > 1 ? g.venueName : first.title;
        const priceBadge = free
          ? `<span style="font:600 10px var(--ff-mono),monospace;color:${selected ? "#065f46" : "#34d399"}">$0</span>`
          : n === 1 && first.priceMin != null && first.priceMin > 0
            ? `<span style="font:600 10px var(--ff-mono),monospace;color:${selected ? "#09090b" : "#f5b84a"}">$${Math.round(first.priceMin / 1000)}k</span>`
            : "";
        el.innerHTML = `
          <span class="qhba-pin-inner" style="display:flex;flex-direction:column;align-items:center;transform:${hovered && !selected ? "translateY(-2px)" : "none"};transition:transform .15s">
            <span style="display:flex;align-items:center;gap:6px;padding:4px 10px 4px 5px;border-radius:999px;background:${bg};color:${fg};border:1.5px solid ${border};box-shadow:0 10px 24px -6px rgba(0,0,0,.85);white-space:nowrap;font:600 11.5px var(--ff-sans),sans-serif;letter-spacing:-.01em">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:${selected ? "#09090b22" : `${cat.color}26`};font-size:11.5px;line-height:1;flex-shrink:0">${cat.emoji}</span>
              <span>${esc(label)}</span>
              ${n > 1 ? `<span style="padding:1px 5px;border-radius:999px;background:${selected ? "#09090b1f" : "rgba(255,255,255,.09)"};font:600 10px var(--ff-mono),monospace">×${n}</span>` : ""}
              ${priceBadge}
            </span>
            <span style="width:1.5px;height:6px;background:${border}"></span>
            <span style="width:5px;height:5px;border-radius:999px;background:${cat.color}"></span>
          </span>`;
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (n > 1) setOpenStack((k) => (k === g.key ? null : g.key));
        else setOpenStack(null);
        onSelectRef.current(first);
      });

      pinsRef.current.push(
        new Marker({ element: el, anchor: "bottom" }).setLngLat([g.lng, g.lat]).addTo(map)
      );
    }
  }, [groups, detailed, selectedId, hoveredId]);

  // Stack popover listing every experience at one venue.
  useEffect(() => {
    stackRef.current?.remove();
    stackRef.current = null;
    const map = mapRef.current;
    const g = openStack ? groups.find((x) => x.key === openStack) : null;
    if (!map || !g || g.events.length < 2) return;

    const box = document.createElement("div");
    box.style.cssText =
      "width:280px;max-height:260px;overflow:auto;margin-bottom:44px;padding:6px;border-radius:16px;background:rgba(17,17,19,.97);border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 48px -12px rgba(0,0,0,.85);backdrop-filter:blur(12px)";
    box.innerHTML = `<div style="padding:6px 8px 8px;font:500 10px var(--ff-mono),monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8b93">${esc(clip(g.venueName, 30))} · ${g.events.length} experiencias</div>`;
    box.addEventListener("click", (e) => e.stopPropagation());

    for (const ev of g.events) {
      const c = categoryById[ev.category] ?? categoryById.arte;
      const row = document.createElement("button");
      row.type = "button";
      row.style.cssText = `display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:7px 8px;border:0;border-radius:10px;cursor:pointer;color:#ededef;background:${ev.id === selectedId ? "rgba(245,184,74,.14)" : "transparent"}`;
      row.innerHTML = `
        <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:${c.color}24;border:1px solid ${c.color}66;font-size:11px;flex-shrink:0">${c.emoji}</span>
        <span style="min-width:0;flex:1">
          <span style="display:block;font:600 12px var(--ff-sans),sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ev.title)}</span>
          <span style="display:flex;justify-content:space-between;gap:6px;font:400 10.5px var(--ff-mono),monospace;color:#8b8b93">
            <span>${esc(formatEventDate(ev.startsAt))}</span>
            <span style="color:${ev.isFree ? "#34d399" : "#8b8b93"}">${esc(ev.priceLabel)}</span>
          </span>
        </span>`;
      row.addEventListener("mouseenter", () => (row.style.background = "rgba(255,255,255,.05)"));
      row.addEventListener(
        "mouseleave",
        () => (row.style.background = ev.id === selectedId ? "rgba(245,184,74,.14)" : "transparent")
      );
      row.addEventListener("click", () => onSelectRef.current(ev));
      box.appendChild(row);
    }

    stackRef.current = new Marker({ element: box, anchor: "bottom" })
      .setLngLat([g.lng, g.lat])
      .addTo(map);
  }, [openStack, groups, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const id of Object.keys(RASTERS)) {
      if (map.getLayer(`layer-${id}`)) {
        map.setLayoutProperty(`layer-${id}`, "visibility", id === mapTheme ? "visible" : "none");
      }
    }
  }, [mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: flyTarget.zoom ?? Math.max(map.getZoom(), 15),
      duration: 600,
    });
  }, [flyTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;border-radius:999px;background:#38bdf8;border:2px solid #09090b;box-shadow:0 0 0 6px rgba(56,189,248,.22)";
      userMarkerRef.current = new Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  if (webglError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-ink p-6 text-center text-sm text-muted">
        Tu navegador no tiene WebGL activo. Usá el listado de actividades.
      </div>
    );
  }

  return <div ref={containerRef} data-map-theme={mapTheme} className="absolute inset-0" />;
}

// Kept for API compatibility with callers that import the source type.
export type { GeoJSONSource };
