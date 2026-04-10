import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Publisher } from "../types";

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function PublishersPage() {
  /* ── list state ── */
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /* ── create state ── */
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [circulation, setCirculation] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  /* ── load publishers ── */
  const loadPublishers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchPublishers();
      setPublishers(res.publishers);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPublishers();
  }, [loadPublishers]);

  /* ── create handler ── */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const body: Parameters<typeof api.createPublisher>[0] = {
        name: name.trim(),
      };
      if (city.trim()) body.city = city.trim();
      if (state.trim()) body.state = state.trim();
      if (websiteUrl.trim()) body.websiteUrl = websiteUrl.trim();
      if (contactEmail.trim()) body.contactEmail = contactEmail.trim();
      if (circulation.trim())
        body.circulation = parseInt(circulation.trim(), 10);

      await api.createPublisher(body);
      setCreateSuccess(`"${name.trim()}" created.`);
      setName("");
      setCity("");
      setState("");
      setWebsiteUrl("");
      setContactEmail("");
      setCirculation("");
      void loadPublishers();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <h1>Publishers</h1>
      <p className="muted">Manage media publishers and their inventory.</p>

      {/* ── Create form ── */}
      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Add publisher</h2>
        <form onSubmit={onCreate} className="stack">
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              placeholder="e.g. Boston Globe"
            />
          </label>
          <div className="two-col">
            <label className="field">
              <span>City (optional)</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={100}
                placeholder="e.g. Boston"
              />
            </label>
            <label className="field">
              <span>State (optional)</span>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={100}
                placeholder="e.g. MA"
              />
            </label>
          </div>
          <div className="two-col">
            <label className="field">
              <span>Website (optional)</span>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="field">
              <span>Contact email (optional)</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="ads@publisher.com"
              />
            </label>
          </div>
          <label className="field">
            <span>Circulation (optional)</span>
            <input
              type="number"
              value={circulation}
              onChange={(e) => setCirculation(e.target.value)}
              min="0"
              placeholder="e.g. 250000"
            />
          </label>
          {createError && (
            <p className="error" role="alert">
              {createError}
            </p>
          )}
          {createSuccess && (
            <p className="success" role="status">
              {createSuccess}
            </p>
          )}
          <button type="submit" className="btn primary" disabled={creating}>
            {creating ? "Creating…" : "Add publisher"}
          </button>
        </form>
      </section>

      {/* ── Publisher list ── */}
      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h2>All publishers</h2>
        {loading && <p className="muted">Loading…</p>}
        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}
        {!loading && publishers.length === 0 && !listError && (
          <p className="muted">No publishers yet.</p>
        )}
        {!loading && publishers.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th>Circulation</th>
                  <th>Inventory</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {publishers.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <Link to={`/publishers/${p.id}`}>{p.name}</Link>
                      </div>
                      {p.websiteUrl && (
                        <a
                          className="small"
                          href={p.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {p.websiteUrl}
                        </a>
                      )}
                    </td>
                    <td>
                      {p.city || p.state
                        ? `${p.city ?? ""}${p.city && p.state ? ", " : ""}${p.state ?? ""}`
                        : "—"}
                    </td>
                    <td>{p.contactEmail ?? "—"}</td>
                    <td>
                      {p.circulation != null
                        ? p.circulation.toLocaleString()
                        : "—"}
                    </td>
                    <td>{p._count?.inventory ?? 0}</td>
                    <td>{p.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
