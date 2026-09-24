import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import type { SessionMembership } from "../types";

const STORAGE_KEY = "portal-org";

interface OrgState {
  orgId: string;
  setOrgId: (id: string) => void;
  memberships: SessionMembership[];
  organizationName: string;
}

const OrgContext = createContext<OrgState | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const memberships = session?.memberships ?? [];
  const [orgId, setOrgIdState] = useState("");

  useEffect(() => {
    if (memberships.length === 0) {
      setOrgIdState("");
      return;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const valid = memberships.some((m) => m.organizationId === stored);
    setOrgIdState(valid && stored ? stored : memberships[0].organizationId);
  }, [session]);

  const setOrgId = (id: string) => {
    sessionStorage.setItem(STORAGE_KEY, id);
    setOrgIdState(id);
  };

  const value = useMemo<OrgState>(() => {
    const current = memberships.find((m) => m.organizationId === orgId);
    return {
      orgId,
      setOrgId,
      memberships,
      organizationName: current?.organization.name ?? "",
    };
  }, [orgId, memberships]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgState {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
