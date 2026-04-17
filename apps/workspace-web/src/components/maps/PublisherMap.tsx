import { useEffect, useRef, useState } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { loadGoogleMaps } from "./loadGoogleMaps";

export type PublisherMarker = {
  name: string;
  address: string;
  city: string;
  state: string;
  url: string;
  lat: number;
  lng: number;
};

type PublisherMapProps = {
  markers?: PublisherMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  onMarkerClick?: (marker: PublisherMarker) => void;
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

    clustererRef.current = new MarkerClusterer({ map, markers: built });

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
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
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

function buildPopupHtml(pub: PublisherMarker): string {
  const name = escapeHtml(pub.name);
  const address = escapeHtml(pub.address);
  const city = escapeHtml(pub.city);
  const state = escapeHtml(pub.state);
  const url = escapeHtml(pub.url);
  return `<div class="publisher-popup">
    <strong>${name}</strong>
    <div>${address}</div>
    <div>${city}, ${state}</div>
    <a href="${url}" target="_blank" rel="noopener noreferrer">Visit site →</a>
  </div>`;
}

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
