import { useEffect, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import {
  PublisherMap,
  type PublisherMarker,
} from "../components/maps/PublisherMap";
import { PageHeader } from "../components/PageHeader";

export function PublishersPage() {
  const [publishers, setPublishers] = useState<PublisherMarker[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/publishers.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: PublisherMarker[]) => {
        if (!cancelled) setPublishers(data);
      })
      .catch((err) => {
        console.error("Failed to load publishers:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page">
      <PageHeader
        eyebrow="Research"
        title="Publishers"
        description="Research notes and snapshots on publishers the team is evaluating. Independent of operational publisher records."
      />

      <div className="card publisher-map-card">
        <h2 className="publisher-map-title">Publisher Map</h2>
        <PublisherMap markers={publishers} />
      </div>

      <EmptyState
        initial="P"
        title="No publisher snapshots yet"
        description="Capture notes, audiences, and rate-card observations for any publisher on your research list."
      />
    </section>
  );
}
