import { EmptyState } from "../components/EmptyState";
import {
  PublisherMap,
  type PublisherMarker,
} from "../components/maps/PublisherMap";
import { PageHeader } from "../components/PageHeader";

const SAMPLE_MARKERS: PublisherMarker[] = [
  { id: "nyc", name: "Publisher A — New York", lat: 40.7128, lng: -74.006 },
  {
    id: "la",
    name: "Publisher B — Los Angeles",
    lat: 34.0522,
    lng: -118.2437,
  },
  { id: "chi", name: "Publisher C — Chicago", lat: 41.8781, lng: -87.6298 },
  { id: "mia", name: "Publisher D — Miami", lat: 25.7617, lng: -80.1918 },
  { id: "sea", name: "Publisher E — Seattle", lat: 47.6062, lng: -122.3321 },
];

export function PublishersPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Research"
        title="Publishers"
        description="Research notes and snapshots on publishers the team is evaluating. Independent of operational publisher records."
      />

      <div className="card publisher-map-card">
        <h2 className="publisher-map-title">Publisher Map</h2>
        <PublisherMap markers={SAMPLE_MARKERS} />
      </div>

      <EmptyState
        initial="P"
        title="No publisher snapshots yet"
        description="Capture notes, audiences, and rate-card observations for any publisher on your research list."
      />
    </section>
  );
}
