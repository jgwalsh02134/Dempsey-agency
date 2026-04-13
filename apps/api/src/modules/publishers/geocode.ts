/**
 * Best-effort server-side geocoding via OpenStreetMap Nominatim.
 *
 * Notes:
 *  - No API key required. Public Nominatim usage policy requires:
 *      * a custom User-Agent identifying the app (set below)
 *      * max 1 request/sec — callers should not bulk-loop without throttling
 *  - Network/HTTP/parse failures resolve `{ status: "FAILED" }` rather than throwing,
 *    so callers can persist the status and surface it in the UI.
 *  - We never call this from a per-client request path; only from admin
 *    write paths (publisher create/update/manual re-geocode).
 */

export type GeocodeStatus = "OK" | "FAILED" | "NO_ADDRESS";

export interface GeocodeResult {
  status: GeocodeStatus;
  latitude?: number;
  longitude?: number;
}

interface AddressInput {
  streetAddress?: string | null;
  streetAddress2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
}

/** Build a single search query string from the publisher's address parts. */
function buildQuery(addr: AddressInput): string | null {
  const line1 = [addr.streetAddress, addr.streetAddress2]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" ");
  const parts = [
    line1,
    addr.city,
    addr.state,
    addr.zipCode,
    addr.country,
  ]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  // Need *something* more than just country to be useful.
  if (parts.length === 1 && (addr.country ?? "").trim().length > 0) {
    return null;
  }
  return parts.join(", ");
}

export async function geocodeAddress(
  addr: AddressInput,
): Promise<GeocodeResult> {
  const q = buildQuery(addr);
  if (!q) return { status: "NO_ADDRESS" };

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "DempseyAgency/1.0 (admin geocoder)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { status: "FAILED" };
    const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(body) || body.length === 0) {
      return { status: "FAILED" };
    }
    const lat = Number(body[0].lat);
    const lon = Number(body[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { status: "FAILED" };
    }
    return { status: "OK", latitude: lat, longitude: lon };
  } catch {
    return { status: "FAILED" };
  }
}
