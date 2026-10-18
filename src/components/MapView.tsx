"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type DataDrivenPropertyValueSpecification,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORIES, categoryById, type CategoryId, type MapThemeId } from "@/lib/domain";
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

export interface VenueLocationGroup {
  key: string;
  lat: number;
  lng: number;
  venueName: string;
  barrio: string | null;
  events: MapEventProperties[];
}

interface MapViewProps {
  data: EventsGeoJSON;
  selectedId: number | null;
  hoveredId: number | null;
  mapTheme: MapThemeId;
  userLocation: { lat: number; lng: number } | null;
  flyTarget: { lat: number; lng: number; zoom?: number; ts: number } | null;
  onSelectEvent: (ev: MapEventProperties, siblingEvents?: MapEventProperties[]) => void;
}

const TILE_SOURCES = {
  voyager: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  ],
  light: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  ],
  darkBase: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  ],
  darkRef: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  ],
  osm: [
    "https://servicios.usig.buenosaires.gob.ar/mapcache/tms/1.0.0/amba_con_transporte_3857@GoogleMapsCompatible/{z}/{x}/{y}.png",
  ],
};

function buildMapStyle(initialData: EventsGeoJSON, activeTheme: MapThemeId): StyleSpecification {
  const colorMatch: unknown[] = ["match", ["get", "category"]];
  for (const c of CATEGORIES) {
    colorMatch.push(c.id, c.color);
  }
  colorMatch.push("#e11d48");

  return {
    version: 8,
    sources: {
      "base-voyager": {
        type: "raster",
        tiles: TILE_SOURCES.voyager,
        tileSize: 256,
        attribution: "© OpenStreetMap · Esri · USIG GCBA",
      },
      "base-light": {
        type: "raster",
        tiles: TILE_SOURCES.light,
        tileSize: 256,
        attribution: "© OpenStreetMap · Esri",
      },
      "base-dark": {
        type: "raster",
        tiles: TILE_SOURCES.darkBase,
        tileSize: 256,
        attribution: "© OpenStreetMap · Esri",
      },
      "base-dark-ref": {
        type: "raster",
        tiles: TILE_SOURCES.darkRef,
        tileSize: 256,
      },
      "base-osm": {
        type: "raster",
        tiles: TILE_SOURCES.osm,
        scheme: "tms",
        tileSize: 256,
        attribution: "© USIG Gobierno de la Ciudad de Buenos Aires",
      },
      events: {
        type: "geojson",
        data: initialData as unknown as GeoJSON.FeatureCollection,
      },
    },
    layers: [
      {
        id: "layer-voyager",
        type: "raster",
        source: "base-voyager",
        layout: { visibility: activeTheme === "voyager" ? "visible" : "none" },
      },
      {
        id: "layer-light",
        type: "raster",
        source: "base-light",
        layout: { visibility: activeTheme === "light" ? "visible" : "none" },
      },
      {
        id: "layer-dark",
        type: "raster",
        source: "base-dark",
        layout: { visibility: activeTheme === "dark" ? "visible" : "none" },
        paint: {
          "raster-brightness-min": 0.05,
          "raster-contrast": 0.15,
        },
      },
      {
        id: "layer-dark-ref",
        type: "raster",
        source: "base-dark-ref",
        layout: { visibility: activeTheme === "dark" ? "visible" : "none" },
      },
      {
        id: "layer-osm",
        type: "raster",
        source: "base-osm",
        layout: { visibility: activeTheme === "osm" ? "visible" : "none" },
      },
      {
        id: "event-pins-halo",
        type: "circle",
        source: "events",
        paint: {
          "circle-color": colorMatch as DataDrivenPropertyValueSpecification<string>,
          "circle-opacity": 0.22,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10.5, 8, 14, 13, 17, 18],
        },
      },
      {
        id: "event-pins",
        type: "circle",
        source: "events",
        paint: {
          "circle-color": colorMatch as DataDrivenPropertyValueSpecification<string>,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10.5, 4.5, 14, 7, 17, 10],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      },
    ],
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortText(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1).trim()}…` : str;
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
  const bubbleMarkersRef = useRef<Map<string, Marker>>(new Map());
  const expandedMarkerRef = useRef<Marker | null>(null);

  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [viewportTick, setViewportTick] = useState(0);
  const [webglError, setWebglError] = useState(false);

  const onSelectRef = useRef(onSelectEvent);
  useEffect(() => {
    onSelectRef.current = onSelectEvent;
  }, [onSelectEvent]);

  // Group experiences that share the exact same physical location/venue
  const locationGroups = useMemo<VenueLocationGroup[]>(() => {
    const groups = new Map<string, VenueLocationGroup>();
    for (const feat of data.features) {
      const ev = feat.properties;
      const key = `${ev.lat.toFixed(4)},${ev.lng.toFixed(4)}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          lat: ev.lat,
          lng: ev.lng,
          venueName: ev.venueName,
          barrio: ev.barrio,
          events: [],
        };
        groups.set(key, g);
      }
      g.events.push(ev);
    }
    return Array.from(groups.values());
  }, [data.features]);

  // Initialize MapLibre map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: buildMapStyle(data, mapTheme),
        center: [-58.404, -34.6015],
        zoom: 13.0,
        minZoom: 10.5,
        maxZoom: 18.5,
        maxBounds: [
          [-58.62, -34.76],
          [-58.26, -34.49],
        ],
        attributionControl: false,
      });
    } catch {
      setWebglError(true);
      return;
    }

    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const triggerUpdate = () => setViewportTick((t) => t + 1);

    map.on("load", () => {
      map.resize();
      triggerUpdate();
    });
    map.on("moveend", triggerUpdate);
    map.on("zoomend", triggerUpdate);
    map.on("click", () => {
      setExpandedGroupKey(null);
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      ro.disconnect();
      expandedMarkerRef.current?.remove();
      for (const m of bubbleMarkersRef.current.values()) {
        m.remove();
      }
      bubbleMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GeoJSON source whenever filtered events change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyData = () => {
      const src = map.getSource("events") as GeoJSONSource | undefined;
      if (src) {
        src.setData(data as unknown as GeoJSON.FeatureCollection);
      }
      setViewportTick((t) => t + 1);
    };
    applyData();
    map.once("load", applyData);
  }, [data]);

  // Render real HTML Speech-Bubble "Globitos" on the map for visible locations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Filter location groups inside current map bounds (or fallback to all if bounds not ready)
    const inView = locationGroups.filter((g) => {
      if (!bounds) return true;
      return (
        g.lng >= bounds.getWest() - 0.01 &&
        g.lng <= bounds.getEast() + 0.01 &&
        g.lat >= bounds.getSouth() - 0.01 &&
        g.lat <= bounds.getNorth() + 0.01
      );
    });

    // Prioritize locations with selected/hovered event, then multi-event hubs, up to 85 globitos simultaneously
    const maxBubbles = zoom >= 14.5 ? 110 : zoom >= 13 ? 80 : 60;
    const prioritized = [...inView]
      .sort((a, b) => {
        const aActive = a.events.some((e) => e.id === selectedId || e.id === hoveredId) ? 1 : 0;
        const bActive = b.events.some((e) => e.id === selectedId || e.id === hoveredId) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return b.events.length - a.events.length;
      })
      .slice(0, maxBubbles);

    // Clear previous markers and mount crisp updated HTML globitos
    for (const m of bubbleMarkersRef.current.values()) {
      m.remove();
    }
    bubbleMarkersRef.current.clear();

    for (const group of prioritized) {
      const count = group.events.length;
      const primary = group.events[0];
      const cat = categoryById[primary.category] ?? categoryById.arte;
      const isSelected = group.events.some((e) => e.id === selectedId);
      const isHovered = group.events.some((e) => e.id === hoveredId);
      const hasFree = group.events.some((e) => e.isFree);

      // Collect up to 3 distinct category emojis present at this exact location
      const uniqueCats = Array.from(new Set(group.events.map((e) => e.category))).slice(0, 3);
      const iconsHtml = uniqueCats
        .map((cid) => {
          const c = categoryById[cid] ?? categoryById.arte;
          return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:${c.color};color:#fff;font-size:12px;border:1.5px solid #fff;margin-right:-4px;box-shadow:0 2px 4px rgba(0,0,0,0.25);">${c.emoji}</span>`;
        })
        .join("");

      const el = document.createElement("button");
      el.type = "button";
      el.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        transform: ${isSelected || isHovered ? "scale(1.12)" : "scale(1)"};
        z-index: ${isSelected ? 50 : isHovered ? 40 : count > 1 ? 20 : 10};
        transition: transform 0.16s ease;
      `;

      const labelText =
        count > 1
          ? `${count} exp. · ${shortText(group.venueName, 18)}`
          : shortText(primary.title, 20);

      const bgPill = isSelected
        ? "#0f172a"
        : isHovered
          ? "#e11d48"
          : "rgba(255, 255, 255, 0.97)";
      const textColor = isSelected || isHovered ? "#ffffff" : "#0f172a";
      const borderColor = isSelected ? "#f59e0b" : isHovered ? "#ffffff" : cat.color;

      el.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 3.5px 9px 3.5px 5px;
          border-radius: 999px;
          background: ${bgPill};
          color: ${textColor};
          border: 2px solid ${borderColor};
          box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.38);
          white-space: nowrap;
          max-width: 230px;
        ">
          <div style="display:flex;align-items:center;padding-right:3px;">
            ${iconsHtml}
          </div>
          <span style="font-size:11px;font-weight:800;letter-spacing:-0.01em;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(labelText)}
          </span>
          ${
            hasFree
              ? `<span style="font-family:monospace;font-size:9.5px;font-weight:900;padding:1px 5px;border-radius:999px;background:#10b981;color:#ffffff;">$0</span>`
              : ""
          }
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 7px solid ${borderColor};
          margin-top: -1px;
        "></div>
      `;

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (count > 1) {
          setExpandedGroupKey((prev) => (prev === group.key ? null : group.key));
          onSelectRef.current(primary, group.events);
        } else {
          setExpandedGroupKey(null);
          onSelectRef.current(primary, group.events);
        }
      });

      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat([group.lng, group.lat])
        .addTo(map);

      bubbleMarkersRef.current.set(group.key, marker);
    }
  }, [locationGroups, viewportTick, selectedId, hoveredId]);

  // Render on-map expanded "Racimo de Globitos" popover when a multi-experience location is clicked
  useEffect(() => {
    const map = mapRef.current;
    expandedMarkerRef.current?.remove();
    expandedMarkerRef.current = null;

    if (!map || !expandedGroupKey) return;
    const group = locationGroups.find((g) => g.key === expandedGroupKey);
    if (!group || group.events.length <= 1) return;

    const container = document.createElement("div");
    container.style.cssText = `
      background: rgba(11, 15, 25, 0.96);
      color: #f8fafc;
      border: 1.5px solid rgba(255, 255, 255, 0.18);
      border-radius: 20px;
      padding: 10px;
      width: 280px;
      max-height: 270px;
      overflow-y: auto;
      box-shadow: 0 24px 42px -8px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(16px);
      z-index: 90;
      margin-bottom: 36px;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px 8px 4px;
      border-bottom: 1px dashed rgba(255,255,255,0.15);
      margin-bottom: 7px;
      font-size: 11px;
      font-weight: 800;
      color: #fbbf24;
    `;
    header.innerHTML = `
      <span>📍 ${escapeHtml(shortText(group.venueName, 26))} (${group.events.length})</span>
      <button type="button" style="color:#94a3b8;font-size:12px;font-weight:800;cursor:pointer;background:none;border:none;">✕</button>
    `;
    header.querySelector("button")?.addEventListener("click", (e) => {
      e.stopPropagation();
      setExpandedGroupKey(null);
    });
    container.appendChild(header);

    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:5px;";

    for (const ev of group.events) {
      const cat = categoryById[ev.category] ?? categoryById.arte;
      const itemBtn = document.createElement("button");
      itemBtn.type = "button";
      itemBtn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        text-align: left;
        padding: 6px 8px;
        border-radius: 12px;
        background: ${ev.id === selectedId ? "rgba(225, 29, 72, 0.28)" : "rgba(255, 255, 255, 0.07)"};
        border: 1px solid ${ev.id === selectedId ? "#e11d48" : "rgba(255, 255, 255, 0.1)"};
        color: #ffffff;
        cursor: pointer;
      `;
      itemBtn.innerHTML = `
        <span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:${cat.color};font-size:13px;flex-shrink:0;">
          ${cat.emoji}
        </span>
        <div style="min-width:0;flex:1;">
          <div style="font-size:11.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(ev.title)}
          </div>
          <div style="font-family:monospace;font-size:10px;color:#cbd5e1;display:flex;justify-content:space-between;gap:4px;">
            <span>${escapeHtml(formatEventDate(ev.startsAt))}</span>
            <span style="color:${ev.isFree ? "#34d399" : "#fde68a"};font-weight:800;">${escapeHtml(ev.priceLabel)}</span>
          </div>
        </div>
      `;
      itemBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(ev, group.events);
      });
      list.appendChild(itemBtn);
    }

    container.appendChild(list);
    container.addEventListener("click", (e) => e.stopPropagation());

    expandedMarkerRef.current = new Marker({ element: container, anchor: "bottom" })
      .setLngLat([group.lng, group.lat])
      .addTo(map);
  }, [expandedGroupKey, locationGroups, selectedId]);

  // Switch active raster base layer instantly when mapTheme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const themes: MapThemeId[] = ["voyager", "light", "dark", "osm"];
    for (const t of themes) {
      const layerId = `layer-${t}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", t === mapTheme ? "visible" : "none");
      }
    }
    if (map.getLayer("layer-dark-ref")) {
      map.setLayoutProperty(
        "layer-dark-ref",
        "visibility",
        mapTheme === "dark" ? "visible" : "none"
      );
    }
  }, [mapTheme]);

  // Fly to requested target
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: flyTarget.zoom ?? Math.max(map.getZoom(), 15),
      duration: 600,
    });
  }, [flyTarget]);

  // Render user location marker
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
      el.className =
        "h-4 w-4 rounded-full bg-sky-500 ring-4 ring-sky-500/35 border-2 border-white shadow-lg";
      userMarkerRef.current = new Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  if (webglError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 p-6 text-center dark:bg-slate-900">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Tu navegador tiene aceleración WebGL desactivada. Explorá el listado lateral de
          actividades.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      className="absolute inset-0 h-full w-full"
    />
  );
}
