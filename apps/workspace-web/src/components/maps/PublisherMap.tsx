import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./loadGoogleMaps";

export type PublisherMarker = {
  id: string | number;
  name: string;
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

    // Clear previous markers.
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    for (const pub of markers) {
      const marker = new google.maps.Marker({
        position: { lat: pub.lat, lng: pub.lng },
        map,
        title: pub.name,
      });

      if (onMarkerClick) {
        marker.addListener("click", () => onMarkerClick(pub));
      }

      markersRef.current.push(marker);
    }
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
