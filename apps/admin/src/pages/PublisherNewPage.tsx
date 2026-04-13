import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { PublisherForm } from "../components/PublisherForm";
import type { PublisherInput } from "../types";

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

/**
 * Convert the form's values into a clean create body:
 * - Drop undefined/null.
 * - Trim strings; drop ones that are empty after trim.
 * - Pass through numbers and booleans.
 */
function buildCreateBody(
  values: PublisherInput,
): Omit<PublisherInput, "name"> & { name: string } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length === 0) continue;
      out[k] = trimmed;
    } else {
      out[k] = v;
    }
  }
  return out as Omit<PublisherInput, "name"> & { name: string };
}

const INITIAL: PublisherInput = {
  name: "",
  isActive: true,
  country: "USA",
};

export function PublisherNewPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: PublisherInput) {
    const name = (values.name ?? "").trim();
    if (!name) {
      setError("Publication name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body = buildCreateBody({ ...values, name });
      const created = await api.createPublisher(body);
      navigate(`/publishers/${created.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function onCancel() {
    navigate("/publishers");
  }

  return (
    <>
      <Link
        to="/publishers"
        className="btn ghost"
        style={{ marginBottom: "1rem", display: "inline-block" }}
      >
        &larr; Back to publishers
      </Link>

      <section className="card">
        <div style={{ marginBottom: "0.75rem" }}>
          <h1 style={{ margin: 0 }}>New publisher</h1>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Fill in as much as you have — only the publication name is required.
            You can add inventory and geocode the address after creating.
          </p>
        </div>

        <PublisherForm
          initial={INITIAL}
          submitLabel="Create publisher"
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitting={submitting}
          error={error}
        />
      </section>
    </>
  );
}
