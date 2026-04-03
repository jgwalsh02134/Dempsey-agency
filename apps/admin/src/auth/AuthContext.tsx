import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, getStoredToken, setStoredToken } from "../api/client";
import * as api from "../api/endpoints";
import type { SessionUser } from "../types";

interface AuthState {
  token: string | null;
  session: SessionUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(!!getStoredToken());
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const t = getStoredToken();
    if (!t) {
      setSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await api.fetchSession();
      setSession(s);
    } catch (e) {
      setSession(null);
      if (e instanceof ApiError && e.status === 401) {
        setStoredToken(null);
        setToken(null);
      }
      setError(e instanceof Error ? e.message : "Session failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void refreshSession();
    else {
      setSession(null);
      setLoading(false);
    }
  }, [token, refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setStoredToken(res.token);
      setToken(res.token);
      const s = await api.fetchSession();
      setSession(s);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Login failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setSession(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      session,
      loading,
      error,
      login,
      logout,
      refreshSession,
    }),
    [token, session, loading, error, login, logout, refreshSession],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
