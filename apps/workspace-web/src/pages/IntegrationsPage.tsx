import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { sendSlackTestMessage } from "../lib/integrations";

type ResultTone = "success" | "error" | "warning";
type Result = { tone: ResultTone; message: string };
type Connection = "connected" | "not-connected";

const RESULT_CLEAR_MS = 5000;

export function IntegrationsPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Integrations"
        description="Connect external services to your workspace."
      />
      <div className="integrations-list">
        <SlackCard />
      </div>
    </section>
  );
}

function SlackCard() {
  // Optimistic on mount: assume connected until the backend proves
  // otherwise via a 503 on the test endpoint. Once known "not-connected"
  // the pill stays that way for the session.
  const [connection, setConnection] = useState<Connection>("connected");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  function scheduleClear() {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      setResult(null);
      clearTimerRef.current = null;
    }, RESULT_CLEAR_MS);
  }

  async function handleSend() {
    setSending(true);
    setResult(null);
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    let next: Result;
    try {
      const outcome = await sendSlackTestMessage();
      if (outcome.ok) {
        next = {
          tone: "success",
          message: "Test message sent. Check your Slack channel.",
        };
      } else if (outcome.reason === "not_configured") {
        setConnection("not-connected");
        next = {
          tone: "error",
          message:
            "Slack is not configured. Add SLACK_WEBHOOK_URL to workspace-api environment variables.",
        };
      } else if (outcome.reason === "rate_limited") {
        next = {
          tone: "warning",
          message: "Rate limited. Try again in a minute.",
        };
      } else {
        next = { tone: "error", message: "Failed to send. Try again." };
      }
    } catch {
      next = { tone: "error", message: "Failed to send. Try again." };
    }
    setResult(next);
    setSending(false);
    scheduleClear();
  }

  return (
    <article className="card integration-card">
      <header className="integration-card-head">
        <div className="integration-card-identity">
          <img
            src="/icons/slack.svg"
            alt=""
            width={32}
            height={32}
            className="integration-card-icon"
            aria-hidden="true"
          />
          <h3 className="integration-card-name">Slack</h3>
        </div>
        <span
          className={`pill integration-status integration-status-${connection}`}
        >
          <span className="integration-status-dot" aria-hidden="true" />
          {connection === "connected" ? "Connected" : "Not connected"}
        </span>
      </header>

      <p className="integration-card-description">
        Send workspace notifications to your Slack channel.
      </p>
      {connection === "connected" && (
        <p className="integration-card-meta">
          Posting to your configured channel.
        </p>
      )}

      <div className="integration-card-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSend}
          disabled={sending}
        >
          {sending ? "Sending…" : "Send test message"}
        </button>
      </div>

      <div
        className="integration-result-region"
        role="status"
        aria-live="polite"
      >
        {result && (
          <div className={`integration-result integration-result-${result.tone}`}>
            {result.message}
          </div>
        )}
      </div>
    </article>
  );
}
