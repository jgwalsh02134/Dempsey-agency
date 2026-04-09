import { apiFetch } from "./client";
import type {
  DocumentDownloadResponse,
  LoginResponse,
  OrgCampaignsResponse,
  OrgDocumentsResponse,
  SessionUser,
} from "../types";

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    token: null,
  });
}

export async function fetchSession(): Promise<SessionUser> {
  return apiFetch<SessionUser>("/api/v1/auth/me");
}

export async function fetchOrgDocuments(
  orgId: string,
): Promise<OrgDocumentsResponse> {
  return apiFetch<OrgDocumentsResponse>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/documents`,
  );
}

export async function fetchDocumentDownloadUrl(
  id: string,
): Promise<DocumentDownloadResponse> {
  return apiFetch<DocumentDownloadResponse>(
    `/api/v1/documents/${encodeURIComponent(id)}/download`,
  );
}

export async function fetchOrgCampaigns(
  orgId: string,
): Promise<OrgCampaignsResponse> {
  return apiFetch<OrgCampaignsResponse>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/campaigns`,
  );
}
