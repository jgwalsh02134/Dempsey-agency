import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, apiJson, ApiError } from "../lib/api";

export type WorkspaceUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mustResetPassword: boolean;
};

type MeResponse = { user: WorkspaceUser };

type AuthContextValue = {
  user: WorkspaceUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<WorkspaceUser>;
  signOut: () => Promise<void>;
  acceptInvite: (
    token: string,
    password: string,
    name?: string,
  ) => Promise<WorkspaceUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ME_ENDPOINT = "/api/workspace/auth/me";
const LOGIN_ENDPOINT = "/api/workspace/auth/login";
const LOGOUT_ENDPOINT = "/api/workspace/auth/logout";
const ACCEPT_INVITE_ENDPOINT = "/api/workspace/auth/invite/accept";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  // On mount, check for an existing session via GET /auth/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<MeResponse>(ME_ENDPOINT);
        if (!cancelled) setUser(res.user);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status !== 401) {
            // Unexpected network/server error — log but treat as signed out
            console.warn("auth/me check failed:", err.message);
          }
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<WorkspaceUser> => {
      const res = await apiJson<MeResponse>(LOGIN_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await apiFetch(LOGOUT_ENDPOINT, { method: "POST" });
    } catch {
      // swallow — we still clear client state below
    } finally {
      setUser(null);
    }
  }, []);

  const acceptInvite = useCallback(
    async (
      token: string,
      password: string,
      name?: string,
    ): Promise<WorkspaceUser> => {
      const body: Record<string, string> = { token, password };
      if (name !== undefined) body.name = name;
      const res = await apiJson<MeResponse>(ACCEPT_INVITE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      signIn,
      signOut,
      acceptInvite,
    }),
    [user, isLoading, signIn, signOut, acceptInvite],
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
