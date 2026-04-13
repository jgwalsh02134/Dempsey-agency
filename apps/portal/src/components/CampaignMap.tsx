import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CampaignMapPublisher } from "../types";

// Leaflet's default marker icons rely on bundled PNG paths that Vite can't
// resolve out of the box. Point explicitly at the CDN-hosted assets so we
// don't need to wire up asset imports.
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

interface Props {
  publishers: CampaignMapPublisher[];
}

/** Subcomponent: fits the map to the marker bounds whenever the set changes. */
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

function formatAddress(p: CampaignMapPublisher): string | null {
  const line1 = p.streetAddress?.trim();
  const cityState = [p.city, p.state].filter(Boolean).join(", ");
  const line2 = [cityState, p.zipCode].filter(Boolean).join(" ").trim();
  const parts = [line1, line2, p.country?.trim()].filter(
    (s): s is string => !!s && s.length > 0,
  );
  return parts.length > 0 ? parts.join("\n") : null;
}

export function CampaignMap({ publishers }: Props) {
  const mapped = useMemo(
    () =>
      publishers.filter(
        (p): p is CampaignMapPublisher & { latitude: number; longitude: number } =>
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
      <p className="text-muted">
        No publishers with location data are attached to this campaign yet.
      </p>
    );
  }

  // Fallback center — replaced immediately by AutoFit.
  const fallbackCenter: [number, number] = points[0];

  return (
    <div
      style={{
        height: "24rem",
        width: "100%",
        borderRadius: "0.5rem",
        overflow: "hidden",
        border: "1px solid var(--color-border, #e5e7eb)",
      }}
    >
      <MapContainer
        center={fallbackCenter}
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
          const addr = formatAddress(p);
          const loc = [p.city, p.state].filter(Boolean).join(", ");
          return (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={defaultIcon}
            >
              <Popup>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                {loc && (
                  <div style={{ marginTop: "0.15rem" }}>{loc}</div>
                )}
                {addr && (
                  <div
                    style={{
                      marginTop: "0.35rem",
                      whiteSpace: "pre-line",
                      fontSize: "0.85em",
                    }}
                  >
                    {addr}
                  </div>
                )}
                {p.websiteUrl && (
                  <div style={{ marginTop: "0.35rem" }}>
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
