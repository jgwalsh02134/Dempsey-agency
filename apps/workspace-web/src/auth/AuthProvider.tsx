/**
 * TEMPORARY CLIENT-ONLY AUTH GATE.
 *
 * This is a placeholder front-end session flag — NOT real authentication.
 * It exists so we can wire up /login routing behavior before the backend
 * workspace-api auth endpoints land. It stores a single identifier in
 * localStorage and trusts it. Do NOT treat this as a security boundary.
 *
 * Replace this module when real auth is wired through workspace-api
 * (JWT, cookie session, or equivalent).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "workspace-session-temp";

type Session = {
  email: string;
};

type AuthContextValue = {
  session: Session | null;
  isAuthenticated: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "email" in parsed &&
      typeof (parsed as { email: unknown }).email === "string"
    ) {
      return { email: (parsed as { email: string }).email };
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession);

  const signIn = useCallback((email: string) => {
    const next: Session = { email };
    setSession(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — in-memory session still works for the tab
    }
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Cross-tab sync so signing out in one tab propagates.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setSession(readStoredSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
