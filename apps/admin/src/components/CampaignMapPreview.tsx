import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Admin-side map preview for campaign publishers.
 *
 * Input is intentionally minimal — anything with name + lat/lng renders as a
 * marker. Non-geocoded publishers are filtered out here so callers can pass
 * the full selected list without pre-filtering.
 */

// Point explicitly at the CDN assets so Vite doesn't need to resolve the
// bundled PNGs from leaflet's package (which it can't without extra config).
const defaultIcon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapMarkerPublisher {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  streetAddress?: string | null;
  zipCode?: string | null;
  websiteUrl?: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  publishers: MapMarkerPublisher[];
  height?: string;
}

function AutoFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, points]);
  return null;
}

function EmptyState({
  title,
  body,
  height,
}: {
  title: string;
  body: string;
  height: string;
}) {
  return (
    <div
      className="pub-map-empty"
      style={{ height }}
      role="status"
      aria-live="polite"
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ color: "var(--color-secondary, #64748b)" }}
      >
        <path d="M12 21s-7-7.58-7-12a7 7 0 1 1 14 0c0 4.42-7 12-7 12z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
      <div className="pub-map-empty-title">{title}</div>
      <div className="pub-map-empty-body">{body}</div>
    </div>
  );
}

export function CampaignMapPreview({
  publishers,
  height = "22rem",
}: Props) {
  const mapped = useMemo(
    () =>
      publishers.filter(
        (p): p is MapMarkerPublisher & { latitude: number; longitude: number } =>
          p.latitude != null && p.longitude != null,
      ),
    [publishers],
  );

  const points = useMemo<[number, number][]>(
    () => mapped.map((p) => [p.latitude, p.longitude]),
    [mapped],
  );

  if (mapped.length === 0) {
    if (publishers.length === 0) {
      return (
        <EmptyState
          title="No publishers selected"
          body="Add publishers from the catalog to see them on the map."
          height={height}
        />
      );
    }
    return (
      <EmptyState
        title="Selected publishers aren't on the map yet"
        body={`${publishers.length} selected but missing coordinates — open each publisher and click Geocode to place them.`}
        height={height}
      />
    );
  }

  const missing = publishers.length - mapped.length;

  return (
    <div className="pub-map-wrap" style={{ height }}>
      <div className="pub-map-count-badge" aria-hidden="true">
        <strong>{mapped.length}</strong>
        <span>
          {mapped.length === 1 ? "publisher" : "publishers"} on map
        </span>
        {missing > 0 && (
          <span className="pub-map-count-missing">
            · {missing} not geocoded
          </span>
        )}
      </div>
      <MapContainer
        center={points[0]}
        zoom={5}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoFit points={points} />
        {mapped.map((p) => {
          const loc = [p.city, p.state].filter(Boolean).join(", ");
          return (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={defaultIcon}
            >
              <Popup>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {loc && <div>{loc}</div>}
                {p.streetAddress && (
                  <div style={{ fontSize: "0.85em", marginTop: "0.25rem" }}>
                    {p.streetAddress}
                    {p.zipCode ? ` · ${p.zipCode}` : ""}
                  </div>
                )}
                {p.websiteUrl && (
                  <div style={{ marginTop: "0.25rem" }}>
                    <a
                      href={p.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
