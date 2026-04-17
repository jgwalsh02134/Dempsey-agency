export type Publisher = {
  name: string;
  addr: string;
  city: string;
  state: string;
  zip: string;
  dma: string;
  dma_code: string;
  circ: number | null;
  url: string;
  lat: number;
  lng: number;
};

export type DmaSummary = {
  dma_code: string;
  dma: string;
  count: number;
  total_circulation: number | null;
  states: string[];
  centroid_lat: number;
  centroid_lng: number;
};

const PUBLISHERS_URL = "/data/publishers.json";
const DMA_SUMMARY_URL = "/data/dma-summary.json";

let publishersPromise: Promise<Publisher[]> | null = null;
let dmaSummaryPromise: Promise<DmaSummary[]> | null = null;

export function loadPublishers(): Promise<Publisher[]> {
  if (!publishersPromise) {
    publishersPromise = fetch(PUBLISHERS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Publisher[]>;
      })
      .catch((err) => {
        publishersPromise = null;
        throw err;
      });
  }
  return publishersPromise;
}

export function loadDmaSummary(): Promise<DmaSummary[]> {
  if (!dmaSummaryPromise) {
    dmaSummaryPromise = fetch(DMA_SUMMARY_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DmaSummary[]>;
      })
      .catch((err) => {
        dmaSummaryPromise = null;
        throw err;
      });
  }
  return dmaSummaryPromise;
}

export function groupByDma(pubs: Publisher[]): Map<string, Publisher[]> {
  const out = new Map<string, Publisher[]>();
  for (const p of pubs) {
    const bucket = out.get(p.dma_code);
    if (bucket) bucket.push(p);
    else out.set(p.dma_code, [p]);
  }
  return out;
}

export function groupByState(pubs: Publisher[]): Map<string, Publisher[]> {
  const out = new Map<string, Publisher[]>();
  for (const p of pubs) {
    const bucket = out.get(p.state);
    if (bucket) bucket.push(p);
    else out.set(p.state, [p]);
  }
  return out;
}

export function totalCirculation(pubs: Publisher[]): number {
  let total = 0;
  for (const p of pubs) if (p.circ !== null) total += p.circ;
  return total;
}

const MIN_SEARCH_LEN = 3;

export function searchPublishers(
  pubs: Publisher[],
  query: string,
): Publisher[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_SEARCH_LEN) return pubs;
  return pubs.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.state.toLowerCase().includes(q) ||
      p.dma.toLowerCase().includes(q) ||
      p.dma_code.includes(q),
  );
}

export function formatCirc(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US");
}
