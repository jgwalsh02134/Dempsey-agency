# Workspace publishers dataset

Two JSON files for the `/publishers` page in `apps/workspace-web`. Drop
them at `apps/workspace-web/public/data/` in the repo.

## `publishers.json` — 268 records

Built by merging three sources you had:

- `publisher_locations.html` → DMA, circulation, ZIP, full addresses
- `publisher_geo_markers.html` → latitude/longitude (267 direct matches;
  one record, "Our Towne" in Hyde Park NY, geocoded to the town centroid
  because the source row had empty address + ZIP)
- Existing schema from your current `publishers.json` → `state` field

Fields:

```ts
{
  name: string           // e.g. "Anchorage Press"
  addr: string           // street address
  city: string
  state: string          // 2-letter code (AK, NY, CA, ...)
  zip: string            // 5-digit; "" for a few records
  dma: string            // e.g. "ATLANTA"
  dma_code: string       // Nielsen DMA code, e.g. "524"
  circ: number | null    // circulation, null if source had no data
  url: string
  lat: number            // 4-decimal precision
  lng: number            // 4-decimal precision
}
```

Coverage:
- 268/268 records have lat/lng (all plot)
- 184/268 records have circulation (the rest are `null`)
- 268/268 have URLs
- 41 states, 87 DMAs

## `dma-summary.json` — 87 records

Derived from `publishers.json`. Saves the frontend from aggregating on
every render, and gives the DMA browser view a pre-sorted list. Regenerate
from `publishers.json` if that ever changes.

Fields:

```ts
{
  dma_code: string
  dma: string
  count: number              // publishers in this DMA
  total_circulation: number | null
  states: string[]           // states this DMA touches (usually 1, sometimes 2)
  centroid_lat: number       // average of member publishers' lat/lng
  centroid_lng: number
}
```

Sorted by `count` desc, then name. Top 5 are Chicago (15), Atlanta (13),
Tucson (13), Des Moines–Ames (11), Providence–New Bedford (10).

## Data fixes applied

1. **Elmira (Corning) DMA code corrected** — the source HTML had three
   Pennsylvania publishers (Morning Times, Towanda Printing, The Daily
   Review) tagged as `ELMIRA (CORNING)` with `dma_code: 536`. That's wrong
   — 536 is YOUNGSTOWN. Elmira is 565. Fixed.
2. **Markdown-wrapped URLs unwrapped** — a couple of OH records had
   `"[chagrinvalleytoday.com](https://chagrinvalleytoday.com)"` as the URL
   field. Stripped to just the URL.
3. **Circulation normalized** — source was strings like `"8,500"` or `""`.
   Now `number | null`.
4. **Sorted** by state → city → name for stable diffs.

## Regenerating

If you ever need to rebuild these from the source HTMLs, keep the three
merge rules above in mind. The key join is `publisher.name → marker
tooltip name` from the geo_markers HTML. There are three duplicate names
in that file (same paper name appears in multiple rows) — the merger
keeps the last coord seen, which was fine for this dataset but worth
noting if the data grows.
