"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type DataDrivenPropertyValueSpecification,
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

function buildMapStyle(initialData: EventsGeoJSON, activeTheme: MapThemeId): StyleSpecification {
  const colorMatch: unknown[] = ["match", ["get", "category"]];
  for (const c of CATEGORIES) {
    colorMatch.push(c.id, c.color);
  }
  colorMatch.push("#2563eb");

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
        clusterMaxZoom: 15,
        clusterRadius: 44,
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
          "raster-brightness-min": 0.04,
          "raster-contrast": 0.14,
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
            "rgba(37, 99, 235, 0.22)",
            20,
            "rgba(124, 58, 237, 0.26)",
            75,
            "rgba(225, 29, 72, 0.28)",
          ],
          "circle-radius": ["step", ["get", "point_count"], 24, 20, 30, 75, 37],
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
            "#2563eb",
            20,
            "#7c3aed",
            75,
            "#e11d48",
          ],
          "circle-radius": ["step", ["get", "point_count"], 17, 20, 22, 75, 27],
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
          "circle-radius": 18,
          "circle-color": "rgba(14, 165, 233, 0.24)",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#0284c7",
        },
      },
      {
        id: "event-selected-ring",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], -1]],
        paint: {
          "circle-radius": 20,
          "circle-color": "rgba(15, 23, 42, 0.22)",
          "circle-stroke-width": 3.5,
          "circle-stroke-color": "#0f172a",
        },
      },
      {
        id: "event-pins",
        type: "circle",
        source: "events",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": colorMatch as DataDrivenPropertyValueSpecification<string>,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10.5, 6.5, 13.5, 9, 16.5, 12.5],
          "circle-stroke-width": 2.2,
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
        center: [-58.4173, -34.6037],
        zoom: 12.3,
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

    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "qhba-popup",
      maxWidth: "280px",
    });
    popupRef.current = popup;

    const syncGeoJSON = () => {
      const src = map.getSource("events") as GeoJSONSource | undefined;
      if (src) {
        src.setData(dataRef.current as unknown as GeoJSON.FeatureCollection);
      }
    };

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
        map.easeTo({ center: coords, zoom: Math.min(zoom + 0.6, 17.5), duration: 420 });
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
        <div style="padding:10px 12px;min-width:210px;max-width:265px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${cat.color};color:#fff;">
              ${cat.emoji} ${escapeHtml(cat.shortLabel)}
            </span>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${
              ev.isFree ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.12)"
            };color:${ev.isFree ? "#34d399" : "#f1f5f9"};">
              ${escapeHtml(ev.priceLabel)}
            </span>
          </div>
          <div style="font-size:12.5px;font-weight:700;line-height:1.3;color:#ffffff;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHtml(ev.title)}
          </div>
          <div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(formatEventDate(ev.startsAt))} · ${escapeHtml(ev.venueName)}
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
      map.setLayoutProperty("layer-dark-ref", "visibility", mapTheme === "dark" ? "visible" : "none");
    }
  }, [mapTheme]);

  // Update GeoJSON source whenever filtered events change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyData = () => {
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
      zoom: flyTarget.zoom ?? Math.max(map.getZoom(), 15),
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
