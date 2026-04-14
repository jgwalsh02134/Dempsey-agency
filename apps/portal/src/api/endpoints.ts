import { apiFetch } from "./client";
import type {
  Campaign,
  CampaignPlacementsResponse,
  CampaignPublishersResponse,
  CampaignSubmissionsResponse,
  CreativeSubmission,
  DocumentDownloadResponse,
  LoginResponse,
  OrgCampaignsResponse,
  OrgDocumentsResponse,
  OrgInvoicesResponse,
  Placement,
  PlacementClientResponse,
  SessionUser,
  SubmissionDownloadResponse,
  SubmissionPreviewResponse,
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

export async function forgotPassword(
  email: string,
): Promise<{ success: boolean }> {
  return apiFetch("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    token: null,
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: boolean }> {
  return apiFetch("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
    token: null,
  });
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

export async function fetchSubmissionPreviewUrl(
  id: string,
): Promise<SubmissionPreviewResponse> {
  return apiFetch<SubmissionPreviewResponse>(
    `/api/v1/submissions/${encodeURIComponent(id)}/preview`,
  );
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  return apiFetch<Campaign>(
    `/api/v1/campaigns/${encodeURIComponent(id)}`,
  );
}

export async function respondToPlacement(
  id: string,
  body: { response: PlacementClientResponse; note?: string | null },
): Promise<Placement> {
  return apiFetch<Placement>(
    `/api/v1/placements/${encodeURIComponent(id)}/client-response`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchCampaignPlacements(
  campaignId: string,
): Promise<CampaignPlacementsResponse> {
  return apiFetch<CampaignPlacementsResponse>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/placements`,
  );
}

export async function fetchCampaignPublishers(
  campaignId: string,
): Promise<CampaignPublishersResponse> {
  return apiFetch<CampaignPublishersResponse>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/publishers`,
  );
}
