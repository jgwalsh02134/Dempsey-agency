import { apiFetch } from "./client";
import type {
  AccountRequestWithInvite,
  AccountRequestStatus,
  AccountRequestsResponse,
  AICreativeReview,
  Campaign,
  CampaignStatus,
  CampaignSubmissionsResponse,
  CreativeSubmission,
  Document,
  Invoice,
  InvoiceStatus,
  LoginResponse,
  Organization,
  OrgCampaignsResponse,
  OrgDocumentsResponse,
  OrgInvoicesResponse,
  OrgUsersResponse,
  SessionUser,
  SubmissionStatus,
} from "../types";

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    token: null,
  });
}

export async function fetchSession(): Promise<SessionUser> {
  return apiFetch<SessionUser>("/api/v1/auth/me");
}

export async function fetchOrganizations(): Promise<Organization[]> {
  return apiFetch<Organization[]>("/api/v1/organizations");
}

export async function fetchOrgUsers(orgId: string): Promise<OrgUsersResponse> {
  return apiFetch<OrgUsersResponse>(`/api/v1/organizations/${encodeURIComponent(orgId)}/users`);
}

export async function createUser(body: {
  email: string;
  password: string;
  name?: string;
  organizationId: string;
  role: string;
}): Promise<unknown> {
  return apiFetch("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createClientOrganization(body: {
  name: string;
  agencyOrganizationId: string;
}): Promise<Organization> {
  return apiFetch<Organization>("/api/v1/organizations", {
    method: "POST",
    body: JSON.stringify({
      name: body.name,
      type: "CLIENT",
      agencyOrganizationId: body.agencyOrganizationId,
    }),
  });
}

/** PATCH role — success is HTTP 2xx only; UI applies role from request args (body may be empty behind some proxies). */
export async function patchUserRole(
  userId: string,
  body: { organizationId: string; role: string },
): Promise<void> {
  await apiFetch<unknown>(
    `/api/v1/users/${encodeURIComponent(userId)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function deactivateUser(userId: string): Promise<unknown> {
  return apiFetch(`/api/v1/users/${encodeURIComponent(userId)}/deactivate`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export async function fetchOrgDocuments(
  orgId: string,
): Promise<OrgDocumentsResponse> {
  return apiFetch<OrgDocumentsResponse>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/documents`,
  );
}

export async function uploadDocument(
  orgId: string,
  data: FormData,
): Promise<Document> {
  return apiFetch<Document>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/documents`,
    { method: "POST", body: data },
  );
}

export async function deleteDocument(id: string): Promise<void> {
  await apiFetch(`/api/v1/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchOrgCampaigns(
  orgId: string,
): Promise<OrgCampaignsResponse> {
  return apiFetch<OrgCampaignsResponse>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/campaigns`,
  );
}

export async function createCampaign(
  orgId: string,
  body: {
    title: string;
    description?: string;
    status?: CampaignStatus;
    startDate?: string;
    endDate?: string;
  },
): Promise<Campaign> {
  return apiFetch<Campaign>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/campaigns`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function patchCampaign(
  id: string,
  body: { status?: CampaignStatus },
): Promise<Campaign> {
  return apiFetch<Campaign>(
    `/api/v1/campaigns/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiFetch(`/api/v1/campaigns/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchOrgInvoices(
  orgId: string,
): Promise<OrgInvoicesResponse> {
  return apiFetch<OrgInvoicesResponse>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/invoices`,
  );
}

export async function createInvoice(
  orgId: string,
  body: {
    title: string;
    description?: string;
    amountCents: number;
    currency?: string;
    status?: InvoiceStatus;
    invoiceDate: string;
    dueDate?: string;
  },
): Promise<Invoice> {
  return apiFetch<Invoice>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/invoices`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function patchInvoice(
  id: string,
  body: { status?: InvoiceStatus },
): Promise<Invoice> {
  return apiFetch<Invoice>(
    `/api/v1/invoices/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiFetch(`/api/v1/invoices/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
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

export async function patchSubmission(
  id: string,
  body: { status?: SubmissionStatus; reviewNote?: string | null },
): Promise<CreativeSubmission> {
  return apiFetch<CreativeSubmission>(
    `/api/v1/submissions/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deleteSubmission(id: string): Promise<void> {
  await apiFetch(`/api/v1/submissions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchAccountRequests(): Promise<AccountRequestsResponse> {
  return apiFetch<AccountRequestsResponse>("/api/v1/account-requests");
}

export async function patchAccountRequest(
  id: string,
  body: {
    status: AccountRequestStatus;
    organizationId?: string;
    role?: string;
  },
): Promise<AccountRequestWithInvite> {
  return apiFetch<AccountRequestWithInvite>(
    `/api/v1/account-requests/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function reviewCreative(
  submissionId: string,
): Promise<AICreativeReview> {
  return apiFetch<AICreativeReview>("/api/v1/ai/review-creative", {
    method: "POST",
    body: JSON.stringify({ submissionId }),
  });
}
