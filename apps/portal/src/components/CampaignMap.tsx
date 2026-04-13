import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CampaignMapPublisher } from "../types";

const MOBILE_QUERY = "(max-width: 639px)";

/** Tracks whether the viewport is phone-sized. SSR-safe default is `false`. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

/**
 * Enables or disables Leaflet's touch/drag/zoom handlers at runtime so the
 * map can be passive on mobile until the user intentionally activates it.
 * `scrollWheelZoom` stays disabled in all modes to match prior behavior.
 */
function InteractionGate({ interactive }: { interactive: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.scrollWheelZoom.disable();
    if (interactive) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
    }
  }, [map, interactive]);
  return null;
}

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
  const isMobile = useIsMobile();
  const [mobileActive, setMobileActive] = useState(false);

  // When the viewport leaves the mobile breakpoint, reset the activation so
  // a later rotation back to portrait starts passive again.
  useEffect(() => {
    if (!isMobile) setMobileActive(false);
  }, [isMobile]);

  const interactive = !isMobile || mobileActive;

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
        position: "relative",
        height: "clamp(16rem, 40vh, 24rem)",
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
        <InteractionGate interactive={interactive} />
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

      {/* Mobile-only: passive overlay that lets the page scroll past and
       *  activates the map on a deliberate tap. `touch-action: pan-y` hands
       *  vertical panning back to the browser so scroll isn't hijacked. */}
      {isMobile && !mobileActive && (
        <button
          type="button"
          onClick={() => setMobileActive(true)}
          aria-label="Activate map to pan and zoom"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 500,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0.75rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            touchAction: "pan-y",
          }}
        >
          <span
            style={{
              background: "rgba(17, 24, 39, 0.82)",
              color: "white",
              padding: "0.4rem 0.8rem",
              borderRadius: "999px",
              fontSize: "0.85rem",
              fontWeight: 500,
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
            }}
          >
            Tap to interact
          </span>
        </button>
      )}

      {/* Mobile-only: release back to passive so the user can keep scrolling. */}
      {isMobile && mobileActive && (
        <button
          type="button"
          onClick={() => setMobileActive(false)}
          aria-label="Release map so the page can scroll"
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            zIndex: 500,
            background: "rgba(17, 24, 39, 0.82)",
            color: "white",
            border: "none",
            padding: "0.35rem 0.7rem",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
          }}
        >
          Release
        </button>
      )}
    </div>
  );
}
