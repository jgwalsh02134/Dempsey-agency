import { useEffect, useRef, useState } from "react";
import {
  MarkerClusterer,
  type Cluster,
} from "@googlemaps/markerclusterer";
import type { Publisher } from "../../data/publishers";
import { useTheme, type Theme } from "../../theme/ThemeProvider";
import { loadGoogleMaps } from "./loadGoogleMaps";

export type PublisherMarker = Publisher;

type PublisherMapProps = {
  markers?: Publisher[];
  totalCount?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  onMarkerSelect?: (p: Publisher) => void;
  onClusterSelect?: (publishers: Publisher[]) => void;
  onEscape?: () => void;
  onMapReady?: (map: google.maps.Map) => void;
};

const DEFAULT_CENTER = { lat: 39.5, lng: -98.35 };
const DEFAULT_ZOOM = 4;
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

type MapState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function PublisherMap({
  markers = [],
  totalCount,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  height = "460px",
  onMarkerSelect,
  onClusterSelect,
  onEscape,
  onMapReady,
}: PublisherMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const [state, setState] = useState<MapState>({ status: "loading" });
  const { theme } = useTheme();

  if (!API_KEY) {
    return (
      <div className="map-fallback" style={{ minHeight: height }}>
        Map unavailable — API key not configured.
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGoogleMaps(API_KEY!);
        if (cancelled || !containerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center,
            zoom,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: mapStylesFor(theme),
          });
          onMapReady?.(mapRef.current);
        }

        if (!cancelled) setState({ status: "ready" });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error ? err.message : "Could not load map.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Swap map styles when theme changes.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ styles: mapStylesFor(theme) });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || state.status !== "ready") return;

    clustererRef.current?.clearMarkers();
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const built = markers.map((pub) => {
      const marker = new google.maps.Marker({
        position: { lat: pub.lat, lng: pub.lng },
        title: pub.name,
        icon: markerIcon(theme, false),
        cursor: "pointer",
      });

      marker.addListener("mouseover", () => {
        marker.setIcon(markerIcon(theme, true));
      });
      marker.addListener("mouseout", () => {
        marker.setIcon(markerIcon(theme, false));
      });
      marker.addListener("click", () => {
        onMarkerSelect?.(pub);
      });

      return marker;
    });
    markersRef.current = built;

    clustererRef.current = new MarkerClusterer({
      map,
      markers: built,
      renderer: {
        render: (cluster: Cluster) =>
          buildClusterMarker(cluster, theme),
      },
      onClusterClick: (_event, cluster, mapInstance) => {
        // Default behavior: zoom in. Also bubble the contained publishers up.
        const bounds = cluster.bounds;
        if (bounds) mapInstance.fitBounds(bounds, 48);
        const ps: Publisher[] = [];
        cluster.markers?.forEach((m) => {
          const googleMarker = m as google.maps.Marker;
          const title = googleMarker.getTitle?.();
          const hit = markers.find((p) => p.name === title);
          if (hit) ps.push(hit);
        });
        if (ps.length > 0) onClusterSelect?.(ps);
      },
    });

    // Auto-fit bounds when showing a filtered subset; reset view on full set.
    if (
      typeof totalCount === "number" &&
      markers.length > 0 &&
      markers.length < totalCount
    ) {
      const bounds = new google.maps.LatLngBounds();
      for (const m of markers) bounds.extend({ lat: m.lat, lng: m.lng });
      map.fitBounds(bounds, 48);
    } else if (
      typeof totalCount === "number" &&
      markers.length === totalCount
    ) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
    };
  }, [markers, totalCount, theme, state.status, onMarkerSelect, onClusterSelect]);

  if (state.status === "error") {
    return (
      <div className="map-fallback" style={{ minHeight: height }}>
        {state.message}
      </div>
    );
  }

  return (
    <div className="map-container" style={{ height }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        role="application"
        aria-label="Publisher map"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onEscape?.();
          }
        }}
      />
    </div>
  );
}

/* ==================================================================
   Marker + cluster icon builders
================================================================== */

type Bucket = "sm" | "md" | "lg";

function bucketFor(count: number): Bucket {
  if (count <= 5) return "sm";
  if (count <= 20) return "md";
  return "lg";
}

const BUCKET_RADIUS: Record<Bucket, number> = { sm: 20, md: 28, lg: 36 };
const BUCKET_OPACITY_LIGHT: Record<Bucket, number> = {
  sm: 0.55,
  md: 0.75,
  lg: 0.9,
};
const BUCKET_OPACITY_DARK: Record<Bucket, number> = {
  sm: 0.63,
  md: 0.83,
  lg: 0.98,
};

function tealFor(theme: Theme): string {
  return theme === "dark" ? "#14b8a6" : "#0f766e";
}

function clusterStrokeFor(theme: Theme): {
  color: string;
  width: number;
} {
  return theme === "dark"
    ? { color: "#0b1322", width: 1.5 }
    : { color: "#ffffff", width: 1 };
}

function buildClusterMarker(
  cluster: Cluster,
  theme: Theme,
): google.maps.Marker {
  const count = cluster.count;
  const bucket = bucketFor(count);
  const r = BUCKET_RADIUS[bucket];
  const opacity =
    theme === "dark"
      ? BUCKET_OPACITY_DARK[bucket]
      : BUCKET_OPACITY_LIGHT[bucket];
  const stroke = clusterStrokeFor(theme);
  const fill = tealFor(theme);
  const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}" viewBox="0 0 ${r * 2} ${r * 2}">
  <circle cx="${r}" cy="${r}" r="${r - 2}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke.color}" stroke-width="${stroke.width}"/>
</svg>`;
  return new google.maps.Marker({
    position: cluster.position,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      size: new google.maps.Size(r * 2, r * 2),
      scaledSize: new google.maps.Size(r * 2, r * 2),
      anchor: new google.maps.Point(r, r),
    },
    label: {
      text: String(count),
      color: theme === "dark" ? "#f8fafc" : "#ffffff",
      fontSize: "12px",
      fontWeight: "600",
    },
    title: `${count} publishers`,
    zIndex: 1000 + count,
    cursor: "pointer",
  });
}

const MARKER_RADIUS = 7;
const MARKER_RADIUS_HOVER = 9;

function markerIcon(theme: Theme, hover: boolean): google.maps.Icon {
  const r = hover ? MARKER_RADIUS_HOVER : MARKER_RADIUS;
  const stroke = clusterStrokeFor(theme);
  const fill = tealFor(theme);
  const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}" viewBox="0 0 ${r * 2} ${r * 2}">
  <circle cx="${r}" cy="${r}" r="${r - 1}" fill="${fill}" stroke="${stroke.color}" stroke-width="${stroke.width}"/>
</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: new google.maps.Size(r * 2, r * 2),
    scaledSize: new google.maps.Size(r * 2, r * 2),
    anchor: new google.maps.Point(r, r),
  };
}

/* ==================================================================
   Map styles
================================================================== */

function mapStylesFor(theme: Theme): google.maps.MapTypeStyle[] {
  return theme === "dark" ? DARK_STYLES : LIGHT_STYLES;
}

const LIGHT_STYLES: google.maps.MapTypeStyle[] = [
  // Hide the noise
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.neighborhood",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "road.local", stylers: [{ visibility: "simplified" }] },
  // Neutral land
  { elementType: "geometry", stylers: [{ color: "#eef2f5" }] },
  // Water
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d7e3ea" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  // Roads: highways + arterials only, white stroke
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e2e8f0" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e2e8f0" }],
  },
  // State boundaries
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c2cbd3" }, { weight: 1 }],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#94a3b8" }, { weight: 1 }],
  },
  // Labels
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#eef2f5" }],
  },
];

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  // Hide the noise
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.neighborhood",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "road.local", stylers: [{ visibility: "simplified" }] },
  // Neutral land (matches --bg-elevated #111c33 family)
  { elementType: "geometry", stylers: [{ color: "#111c33" }] },
  // Water
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0b1322" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  // Roads
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334155" }],
  },
  // Boundaries
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ color: "#475569" }, { weight: 1 }],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#64748b" }, { weight: 1 }],
  },
  // Labels
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#111c33" }],
  },
];
