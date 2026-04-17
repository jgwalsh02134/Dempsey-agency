import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Publisher } from "../../data/publishers";
import { formatCirc } from "../../data/publishers";

type Mode = "desktop" | "mobile";

type PublisherOverlayProps = {
  publisher: Publisher | null;
  map: google.maps.Map | null;
  mode: Mode;
  onClose: () => void;
};

export function PublisherOverlay({
  publisher,
  map,
  mode,
  onClose,
}: PublisherOverlayProps) {
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);

  // Escape to close on both modes.
  useEffect(() => {
    if (!publisher) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [publisher, onClose]);

  // Desktop: mount a Google OverlayView anchored to the publisher's lat/lng.
  useEffect(() => {
    if (mode !== "desktop" || !map || !publisher) {
      setHostEl(null);
      return;
    }

    class Positioned extends google.maps.OverlayView {
      private el: HTMLDivElement;
      constructor(private position: google.maps.LatLngLiteral) {
        super();
        this.el = document.createElement("div");
        this.el.className = "publisher-overlay-anchor";
        this.el.style.position = "absolute";
        this.el.style.transform = "translate(-50%, calc(-100% - 18px))";
        this.el.style.pointerEvents = "auto";
      }
      override onAdd(): void {
        const panes = this.getPanes();
        if (panes) panes.floatPane.appendChild(this.el);
      }
      override draw(): void {
        const proj = this.getProjection();
        if (!proj) return;
        const pt = proj.fromLatLngToDivPixel(
          new google.maps.LatLng(this.position.lat, this.position.lng),
        );
        if (pt) {
          this.el.style.left = `${pt.x}px`;
          this.el.style.top = `${pt.y}px`;
        }
      }
      override onRemove(): void {
        this.el.remove();
      }
      getElement(): HTMLDivElement {
        return this.el;
      }
    }

    const overlay = new Positioned({
      lat: publisher.lat,
      lng: publisher.lng,
    });
    overlay.setMap(map);
    overlayRef.current = overlay;
    setHostEl(overlay.getElement());

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      setHostEl(null);
    };
  }, [map, publisher, mode]);

  if (!publisher) return null;

  if (mode === "mobile") {
    return createPortal(
      <div
        className="publisher-sheet-backdrop"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="publisher-sheet"
          role="dialog"
          aria-label={`Details for ${publisher.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="publisher-sheet-close"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
          <OverlayBody publisher={publisher} />
        </div>
      </div>,
      document.body,
    );
  }

  // Desktop portal — waits for OverlayView's onAdd to provide a host.
  if (!hostEl) return null;
  return createPortal(
    <div className="publisher-overlay" role="dialog" aria-label={`Details for ${publisher.name}`}>
      <button
        type="button"
        className="publisher-overlay-close"
        onClick={onClose}
        aria-label="Close details"
      >
        ×
      </button>
      <OverlayBody publisher={publisher} />
      <span className="publisher-overlay-arrow" aria-hidden="true" />
    </div>,
    hostEl,
  );
}

function OverlayBody({ publisher: p }: { publisher: Publisher }) {
  return (
    <div className="publisher-overlay-body">
      <div className="publisher-overlay-name">{p.name}</div>
      <div className="publisher-overlay-loc">
        {p.city}, {p.state}
        {p.zip ? ` ${p.zip}` : ""}
      </div>
      <div className="publisher-overlay-dma">
        <span className="publisher-overlay-dma-label">{p.dma}</span>
        <span className="pill pill-neutral">{p.dma_code}</span>
      </div>
      {p.circ !== null && (
        <div className="publisher-overlay-circ">
          Circ. {formatCirc(p.circ)}
        </div>
      )}
      <a
        className="btn btn-ghost btn-sm publisher-overlay-cta"
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Visit site →
      </a>
    </div>
  );
}
