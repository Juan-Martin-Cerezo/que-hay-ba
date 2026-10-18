"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
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

interface MapViewProps {
  data: EventsGeoJSON;
  selectedId: number | null;
  hoveredId: number | null;
  mapTheme: MapThemeId;
  userLocation: { lat: number; lng: number } | null;
  flyTarget: { lat: number; lng: number; zoom?: number; ts: number } | null;
  onSelectEvent: (ev: MapEventProperties) => void;
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

/**
 * Draws a crisp, platform-independent white vector icon at (cx, cy) inside the pin head.
 */
function drawCategoryGlyph(
  ctx: CanvasRenderingContext2D,
  category: string,
  cx: number,
  cy: number
) {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (category) {
    case "musica": {
      // Beamed eighth notes (♫)
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + 5);
      ctx.lineTo(cx - 5, cy - 8);
      ctx.lineTo(cx + 9, cy - 11);
      ctx.lineTo(cx + 9, cy + 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx - 8.5, cy + 5.5, 4.2, 0, Math.PI * 2);
      ctx.arc(cx + 5.5, cy + 2.5, 4.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "teatro": {
      // Theatrical mask / stage shield with smile & eyes
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 9);
      ctx.quadraticCurveTo(cx, cy - 12, cx + 10, cy - 9);
      ctx.lineTo(cx + 9, cy + 1);
      ctx.quadraticCurveTo(cx, cy + 12, cx, cy + 12);
      ctx.quadraticCurveTo(cx, cy + 12, cx - 9, cy + 1);
      ctx.closePath();
      ctx.stroke();

      // Eyes
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 3, 1.8, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 3, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Smile arc
      ctx.beginPath();
      ctx.arc(cx, cy + 1.5, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    }
    case "arte": {
      // Artist palette / museum frame with star
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 3.5, 2, 0, Math.PI * 2);
      ctx.arc(cx + 3, cy - 4.5, 2, 0, Math.PI * 2);
      ctx.arc(cx + 5.5, cy + 1.5, 2, 0, Math.PI * 2);
      ctx.arc(cx - 2.5, cy + 4.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "gastronomia": {
      // Wine glass / chalice
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 10);
      ctx.lineTo(cx + 7, cy - 10);
      ctx.lineTo(cx + 5, cy - 2);
      ctx.quadraticCurveTo(cx, cy + 4, cx - 5, cy - 2);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx, cy + 10);
      ctx.moveTo(cx - 5, cy + 10);
      ctx.lineTo(cx + 5, cy + 10);
      ctx.stroke();
      break;
    }
    case "aire_libre": {
      // Botanical tree canopy + trunk
      ctx.beginPath();
      ctx.arc(cx, cy - 4.5, 6.5, 0, Math.PI * 2);
      ctx.arc(cx - 5, cy + 0.5, 5, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy + 0.5, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 3);
      ctx.lineTo(cx, cy + 11);
      ctx.stroke();
      break;
    }
    case "talleres":
    default: {
      // Graduation cap / open workshop diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 12, cy - 3);
      ctx.lineTo(cx, cy + 3);
      ctx.lineTo(cx - 12, cy - 3);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx - 7, cy + 1);
      ctx.lineTo(cx - 7, cy + 7);
      ctx.quadraticCurveTo(cx, cy + 11, cx + 7, cy + 7);
      ctx.lineTo(cx + 7, cy + 1);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/**
 * Generates a high-DPI (pixelRatio: 2) custom teardrop map pin with vector icon
 * and optional emerald "$0" badge for free experiences.
 */
function createPinImageData(color: string, category: string, isFree: boolean): ImageData {
  const width = 76;
  const height = 88;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const cx = width / 2;
  const cy = 34;
  const r = 24;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.42)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // Teardrop path
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 0.22, false);
  ctx.quadraticCurveTo(cx + 10, cy + r + 8, cx, height - 8);
  ctx.quadraticCurveTo(cx - 10, cy + r + 8, cx - r * Math.cos(Math.PI * 0.22), cy + r * Math.sin(Math.PI * 0.22));
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // Crisp white outer border
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // Subtle inner dark ring for depth
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw white category vector icon inside the pin head
  drawCategoryGlyph(ctx, category, cx, cy);

  // If free, draw an emerald "$0" pill badge on the top-right corner
  if (isFree) {
    const bx = cx + 17;
    const by = cy - 17;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$0", bx, by + 0.5);
    ctx.restore();
  }

  return ctx.getImageData(0, 0, width, height);
}

function registerAllCategoryPins(map: MapLibreMap) {
  for (const c of CATEGORIES) {
    const normalId = `pin-${c.id}`;
    const freeId = `pin-${c.id}-free`;
    if (!map.hasImage(normalId)) {
      map.addImage(normalId, createPinImageData(c.color, c.id, false), { pixelRatio: 2 });
    }
    if (!map.hasImage(freeId)) {
      map.addImage(freeId, createPinImageData(c.color, c.id, true), { pixelRatio: 2 });
    }
  }
}

function buildMapStyle(initialData: EventsGeoJSON, activeTheme: MapThemeId): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
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
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 34,
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
        id: "clusters-halo",
        type: "circle",
        source: "events",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "rgba(15, 23, 42, 0.20)",
            20,
            "rgba(124, 58, 237, 0.25)",
            60,
            "rgba(225, 29, 72, 0.28)",
          ],
          "circle-radius": ["step", ["get", "point_count"], 23, 20, 29, 60, 35],
        },
      },
      {
        id: "clusters",
        type: "circle",
        source: "events",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#0f172a",
            20,
            "#7c3aed",
            60,
            "#e11d48",
          ],
          "circle-radius": ["step", ["get", "point_count"], 16, 20, 21, 60, 26],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      },
      {
        id: "cluster-count",
        type: "symbol",
        source: "events",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      },
      {
        id: "event-hovered-ring",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], -1]],
        paint: {
          "circle-radius": 24,
          "circle-color": "rgba(225, 29, 72, 0.22)",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#e11d48",
        },
      },
      {
        id: "event-selected-ring",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], -1]],
        paint: {
          "circle-radius": 26,
          "circle-color": "rgba(15, 23, 42, 0.25)",
          "circle-stroke-width": 3.5,
          "circle-stroke-color": "#0f172a",
        },
      },
      {
        id: "event-pins",
        type: "symbol",
        source: "events",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": [
            "concat",
            "pin-",
            ["get", "category"],
            ["case", ["boolean", ["get", "isFree"], false], "-free", ""],
          ],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10.5,
            0.72,
            13,
            0.9,
            15.5,
            1.08,
          ],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
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
  const popupRef = useRef<Popup | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const dataRef = useRef<EventsGeoJSON>(data);
  const onSelectRef = useRef(onSelectEvent);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    dataRef.current = data;
    onSelectRef.current = onSelectEvent;
  }, [data, onSelectEvent]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: buildMapStyle(dataRef.current, mapTheme),
        center: [-58.408, -34.6015],
        zoom: 12.8,
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

    // Register custom high-DPI category icon pins immediately
    registerAllCategoryPins(map);

    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -36],
      className: "qhba-popup",
      maxWidth: "290px",
    });
    popupRef.current = popup;

    const syncGeoJSON = () => {
      registerAllCategoryPins(map);
      const src = map.getSource("events") as GeoJSONSource | undefined;
      if (src) {
        src.setData(dataRef.current as unknown as GeoJSON.FeatureCollection);
      }
    };

    map.on("styleimagemissing", (e) => {
      if (e.id.startsWith("pin-")) {
        registerAllCategoryPins(map);
      }
    });

    map.on("load", () => {
      map.resize();
      syncGeoJSON();
    });

    map.on("click", "clusters", async (e: MapLayerMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
      const clusterFeature = features[0];
      if (!clusterFeature) return;
      const clusterId = clusterFeature.properties?.cluster_id as number;
      const src = map.getSource("events") as GeoJSONSource | undefined;
      if (!src) return;
      try {
        const zoom = await src.getClusterExpansionZoom(clusterId);
        const coords = (clusterFeature.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: Math.min(zoom + 0.7, 17.5), duration: 420 });
      } catch {
        // Ignore expansion errors
      }
    });

    map.on("click", "event-pins", (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0] as MapGeoJSONFeature | undefined;
      if (!feat) return;
      const props = feat.properties as Record<string, unknown>;
      const matched = dataRef.current.features.find((f) => f.properties.id === Number(props.id));
      if (matched) {
        popup.remove();
        onSelectRef.current(matched.properties);
      }
    });

    map.on("mouseenter", "clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "clusters", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("mouseenter", "event-pins", (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const feat = e.features?.[0] as MapGeoJSONFeature | undefined;
      if (!feat) return;
      const props = feat.properties as Record<string, unknown>;
      const matched = dataRef.current.features.find((f) => f.properties.id === Number(props.id));
      if (!matched) return;
      const ev = matched.properties;
      const cat = categoryById[ev.category] ?? categoryById.arte;
      const coords = (feat.geometry as GeoJSON.Point).coordinates.slice() as [number, number];

      const html = `
        <div style="padding:11px 13px;min-width:220px;max-width:275px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:${cat.color};color:#fff;">
              ${cat.emoji} ${escapeHtml(cat.shortLabel)}
            </span>
            <span style="font-family:monospace;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:${
              ev.isFree ? "rgba(16,185,129,0.22)" : "rgba(255,255,255,0.13)"
            };color:${ev.isFree ? "#34d399" : "#f8fafc"};">
              ${escapeHtml(ev.priceLabel)}
            </span>
          </div>
          <div style="font-size:13px;font-weight:800;line-height:1.28;color:#ffffff;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHtml(ev.title)}
          </div>
          <div style="font-size:11px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            📍 ${escapeHtml(ev.venueName)}${ev.barrio ? ` · ${escapeHtml(ev.barrio)}` : ""}
          </div>
          <div style="font-family:monospace;font-size:10.5px;color:#94a3b8;margin-top:3px;">
            🗓️ ${escapeHtml(formatEventDate(ev.startsAt))}
          </div>
        </div>
      `;
      popup.setLngLat(coords).setHTML(html).addTo(map);
    });

    map.on("mouseleave", "event-pins", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    mapRef.current = map;
    return () => {
      ro.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch active raster base layer instantly when mapTheme changes.
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

  // Update GeoJSON source whenever filtered events change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyData = () => {
      registerAllCategoryPins(map);
      const src = map.getSource("events") as GeoJSONSource | undefined;
      if (src) {
        src.setData(data as unknown as GeoJSON.FeatureCollection);
      }
    };
    applyData();
    map.once("load", applyData);
  }, [data]);

  // Highlight selected event pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("event-selected-ring")) return;
    map.setFilter("event-selected-ring", [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "id"], selectedId ?? -1],
    ]);
  }, [selectedId]);

  // Highlight hovered event pin from the sidebar list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("event-hovered-ring")) return;
    map.setFilter("event-hovered-ring", [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "id"], hoveredId ?? -1],
    ]);
  }, [hoveredId]);

  // Fly to requested target.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: flyTarget.zoom ?? Math.max(map.getZoom(), 15.2),
      duration: 650,
    });
  }, [flyTarget]);

  // Render user location marker.
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
