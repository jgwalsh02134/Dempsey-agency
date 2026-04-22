import { useEffect, useRef, useState } from "react";
import {
  fetchSummaryHealth,
  type SummaryHealth,
} from "../lib/publisher-summary";

type UiStatus = "checking" | "ok" | "down";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type DownReason = Extract<SummaryHealth, { status: "down" }>["reason"];

function reasonLabel(reason: DownReason): string {
  switch (reason) {
    case "no_api_key":
      return "no API key";
    case "openai_unreachable":
      return "unreachable";
    case "openai_auth_failed":
      return "auth failed";
    case "openai_error":
      return "upstream error";
  }
}

export function AIStatusIndicator() {
  const [status, setStatus] = useState<UiStatus>("checking");
  const [reason, setReason] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const result = await fetchSummaryHealth();
        if (cancelled) return;
        if (result.status === "ok") {
          setStatus("ok");
          setReason(null);
        } else {
          setStatus("down");
          setReason(reasonLabel(result.reason));
        }
      } catch {
        // Network / parse / auth issues: stay in "checking" per spec.
        if (cancelled) return;
        setStatus("checking");
        setReason(null);
      }
    }

    function start() {
      check();
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      intervalRef.current = window.setInterval(check, CHECK_INTERVAL_MS);
    }

    function stop() {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const label =
    status === "ok"
      ? "AI online"
      : status === "checking"
        ? "AI checking…"
        : `AI unavailable${reason ? ` · ${reason}` : ""}`;

  return (
    <div
      className={`ai-status ai-status-${status}`}
      role="status"
      aria-live="polite"
    >
      <span className="ai-status-dot" aria-hidden="true" />
      <span className="ai-status-label">{label}</span>
    </div>
  );
}
