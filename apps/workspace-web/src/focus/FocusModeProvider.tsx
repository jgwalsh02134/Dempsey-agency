import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "workspace-focus-mode";

type FocusModeContextValue = {
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  toggle: () => void;
};

const FocusModeContext = createContext<FocusModeContextValue | null>(null);

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStorage(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // storage unavailable (private mode, etc.) — ignore
  }
}

// An overlay is considered "open" if any element with role=dialog exists
// in the live DOM (PublisherOverlay uses it in both mobile-sheet and
// desktop-portal variants). Escape should dismiss the overlay before
// touching focus-mode state.
function hasOpenOverlay(): boolean {
  return Boolean(
    document.querySelector('[role="dialog"], [aria-modal="true"]'),
  );
}

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focusMode, setFocusModeState] = useState<boolean>(readInitial);
  const [announcement, setAnnouncement] = useState<string>("");
  const focusModeRef = useRef(focusMode);

  useEffect(() => {
    focusModeRef.current = focusMode;
  }, [focusMode]);

  const setFocusMode = useCallback((v: boolean) => {
    setFocusModeState(v);
    writeStorage(v);
    setAnnouncement(v ? "Focus mode enabled" : "Focus mode disabled");
  }, []);

  const toggle = useCallback(() => {
    setFocusModeState((prev) => {
      const next = !prev;
      writeStorage(next);
      setAnnouncement(next ? "Focus mode enabled" : "Focus mode disabled");
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const inInput =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        if (inInput) return;
        e.preventDefault();
        toggle();
        return;
      }

      if (e.key === "Escape" && focusModeRef.current) {
        if (hasOpenOverlay()) return;
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setFocusMode]);

  return (
    <FocusModeContext.Provider value={{ focusMode, setFocusMode, toggle }}>
      {children}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </FocusModeContext.Provider>
  );
}

export function useFocusMode(): FocusModeContextValue {
  const ctx = useContext(FocusModeContext);
  if (!ctx) {
    throw new Error("useFocusMode must be used within FocusModeProvider");
  }
  return ctx;
}
