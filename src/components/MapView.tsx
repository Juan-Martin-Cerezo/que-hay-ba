"use client";

import { useEffect, useRef } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type DataDrivenPropertyValueSpecification,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORIES, type CategoryId } from "@/lib/domain";

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
  userLocation: { lat: number; lng: number } | null;
  flyTarget: { lat: number; lng: number; zoom?: number; ts: number } | null;
  onSelectEvent: (ev: MapEventProperties) => void;
}

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

export function MapView({
  data,
  selectedId,
  userLocation,
  flyTarget,
  onSelectEvent,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const dataRef = useRef<EventsGeoJSON>(data);
  const onSelectRef = useRef(onSelectEvent);

  useEffect(() => {
    dataRef.current = data;
    onSelectRef.current = onSelectEvent;
  }, [data, onSelectEvent]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: prefersDark ? STYLE_DARK : STYLE_LIGHT,
      center: [-58.4173, -34.6037],
      zoom: 12.2,
      minZoom: 10.5,
      maxZoom: 18.5,
      maxBounds: [
        [-58.62, -34.76],
        [-58.26, -34.49],
      ],
      attributionControl: false,
    });

    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const colorMatch: unknown[] = ["match", ["get", "category"]];
    for (const c of CATEGORIES) {
      colorMatch.push(c.id, c.color);
    }
    colorMatch.push("#475569");

    const setupLayers = () => {
      if (map.getSource("events")) return;

      map.addSource("events", {
        type: "geojson",
        data: dataRef.current as unknown as GeoJSON.FeatureCollection,
        cluster: true,
        clusterMaxZoom: 15,
        clusterRadius: 46,
      });

      map.addLayer({
        id: "clusters-halo",
        type: "circle",
        source: "events",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "rgba(37, 99, 235, 0.18)",
            20,
            "rgba(124, 58, 237, 0.22)",
            75,
            "rgba(225, 29, 72, 0.24)",
          ],
          "circle-radius": ["step", ["get", "point_count"], 24, 20, 30, 75, 36],
        },
      });

      map.addLayer({
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
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "events",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "event-selected-ring",
        type: "circle",
        source: "events",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], -1]],
        paint: {
          "circle-radius": 17,
          "circle-color": "rgba(15, 23, 42, 0.15)",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#0f172a",
        },
      });

      map.addLayer({
        id: "event-pins",
        type: "circle",
        source: "events",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": colorMatch as DataDrivenPropertyValueSpecification<string>,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 7, 14, 9.5, 17, 12],
          "circle-stroke-width": 2.2,
          "circle-stroke-color": "#ffffff",
        },
      });
    };

    map.on("load", setupLayers);

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
        map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 17.5), duration: 450 });
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
        onSelectRef.current(matched.properties);
      }
    });

    for (const layerId of ["clusters", "event-pins"]) {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update GeoJSON source whenever filtered events change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("events") as GeoJSONSource | undefined;
    if (src) {
      src.setData(data as unknown as GeoJSON.FeatureCollection);
    }
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
        "h-4 w-4 rounded-full bg-sky-500 ring-4 ring-sky-500/30 border-2 border-white shadow-md";
      userMarkerRef.current = new Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  return <div ref={containerRef} className="h-full w-full" />;
}
