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
    return (
      <div
        style={{
          height,
          width: "100%",
          borderRadius: "0.5rem",
          border: "1px dashed var(--color-border, #e5e7eb)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-secondary, #64748b)",
          background: "var(--color-surface, #f8fafc)",
          fontSize: "0.9rem",
        }}
      >
        {publishers.length === 0
          ? "No publishers selected — add publishers from the catalog to see them on the map."
          : "Selected publishers have no coordinates yet. Use Geocode on each publisher to place them on the map."}
      </div>
    );
  }

  return (
    <div
      style={{
        height,
        width: "100%",
        borderRadius: "0.5rem",
        overflow: "hidden",
        border: "1px solid var(--color-border, #e5e7eb)",
      }}
    >
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
