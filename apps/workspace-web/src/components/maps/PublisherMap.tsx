import { useEffect, useRef, useState } from "react";
import { MarkerClusterer, type Cluster } from "@googlemaps/markerclusterer";
import type { Publisher } from "../../data/publishers";
import { formatCirc } from "../../data/publishers";
import { loadGoogleMaps } from "./loadGoogleMaps";

export type PublisherMarker = Publisher;

type PublisherMapProps = {
  markers?: Publisher[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  onMarkerClick?: (marker: Publisher) => void;
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
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  height = "460px",
  onMarkerClick,
}: PublisherMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [state, setState] = useState<MapState>({ status: "loading" });

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
            styles: getMapStyles(),
          });
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    clustererRef.current?.clearMarkers();
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }
    const infoWindow = infoWindowRef.current;

    const built = markers.map((pub) => {
      const marker = new google.maps.Marker({
        position: { lat: pub.lat, lng: pub.lng },
        title: pub.name,
      });

      marker.addListener("click", () => {
        infoWindow.setContent(buildPopupHtml(pub));
        infoWindow.open({ map, anchor: marker });
        onMarkerClick?.(pub);
      });

      return marker;
    });
    markersRef.current = built;

    clustererRef.current = new MarkerClusterer({
      map,
      markers: built,
      renderer: tealClusterRenderer,
    });

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
      infoWindow.close();
    };
  }, [markers, onMarkerClick]);

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
      />
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopupHtml(pub: Publisher): string {
  const name = escapeHtml(pub.name);
  const addrLine = pub.addr ? `<div>${escapeHtml(pub.addr)}</div>` : "";
  const city = escapeHtml(pub.city);
  const stateAbbr = escapeHtml(pub.state);
  const zip = pub.zip ? ` ${escapeHtml(pub.zip)}` : "";
  const dma = escapeHtml(pub.dma);
  const dmaCode = escapeHtml(pub.dma_code);
  const circ = escapeHtml(formatCirc(pub.circ));
  const url = escapeHtml(pub.url);
  return `<div class="publisher-popup">
    <strong>${name}</strong>
    ${addrLine}
    <div>${city}, ${stateAbbr}${zip}</div>
    <div class="publisher-popup-meta">DMA ${dma} (${dmaCode}) · Circ ${circ}</div>
    <a href="${url}" target="_blank" rel="noopener noreferrer">Visit site →</a>
  </div>`;
}

type Bucket = "sm" | "md" | "lg";

function bucketFor(count: number): Bucket {
  if (count <= 5) return "sm";
  if (count <= 20) return "md";
  return "lg";
}

const BUCKET_RADIUS: Record<Bucket, number> = { sm: 20, md: 28, lg: 36 };
const BUCKET_OPACITY: Record<Bucket, number> = { sm: 0.55, md: 0.75, lg: 0.9 };

const tealClusterRenderer = {
  render: ({ count, position }: Cluster): google.maps.Marker => {
    const bucket = bucketFor(count);
    const r = BUCKET_RADIUS[bucket];
    const opacity = BUCKET_OPACITY[bucket];
    const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}" viewBox="0 0 ${r * 2} ${r * 2}">
  <circle cx="${r}" cy="${r}" r="${r - 2}" fill="#0f766e" fill-opacity="${opacity}" stroke="#ffffff" stroke-width="2"/>
</svg>`;
    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        size: new google.maps.Size(r * 2, r * 2),
        scaledSize: new google.maps.Size(r * 2, r * 2),
        anchor: new google.maps.Point(r, r),
      },
      label: {
        text: String(count),
        color: "#ffffff",
        fontSize: "12px",
        fontWeight: "600",
      },
      title: `${count} publishers`,
      zIndex: 1000 + count,
    });
  },
};

function getMapStyles(): google.maps.MapTypeStyle[] {
  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark";

  if (!isDark) return [];

  return [
    { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
    {
      featureType: "administrative.country",
      elementType: "geometry.stroke",
      stylers: [{ color: "#4b6878" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#304a7d" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#255763" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#0e1626" }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#283d6a" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
  ];
}
