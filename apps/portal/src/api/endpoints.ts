import { apiFetch } from "./client";
import type {
  CampaignSubmissionsResponse,
  CreativeSubmission,
  DocumentDownloadResponse,
  LoginResponse,
  OrgCampaignsResponse,
  OrgDocumentsResponse,
  OrgInvoicesResponse,
  SessionUser,
  SubmissionDownloadResponse,
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

export async function fetchOrgInvoices(
  orgId: string,
): Promise<OrgInvoicesResponse> {
  return apiFetch<OrgInvoicesResponse>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/invoices`,
  );
}

export async function fetchCampaignSubmissions(
  campaignId: string,
): Promise<CampaignSubmissionsResponse> {
  return apiFetch<CampaignSubmissionsResponse>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/submissions`,
  );
}

export async function uploadSubmission(
  campaignId: string,
  data: FormData,
): Promise<CreativeSubmission> {
  return apiFetch<CreativeSubmission>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/submissions`,
    { method: "POST", body: data },
  );
}

export async function fetchSubmissionDownloadUrl(
  id: string,
): Promise<SubmissionDownloadResponse> {
  return apiFetch<SubmissionDownloadResponse>(
    `/api/v1/submissions/${encodeURIComponent(id)}/download`,
  );
}
