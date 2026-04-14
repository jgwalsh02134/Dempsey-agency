import { apiFetch } from "./client";
import type {
  AccountRequestWithInvite,
  AccountRequestStatus,
  AccountRequestsResponse,
  AdminOverview,
  AdminSubmissionsResponse,
  AICreativeReview,
  Campaign,
  CampaignPlacementsResponse,
  CampaignPublishersResponse,
  CampaignStatus,
  CampaignSubmissionsResponse,
  CreativeSubmission,
  Document,
  InventoryItem,
  Invoice,
  InvoiceStatus,
  LoginResponse,
  Organization,
  OrgCampaignsResponse,
  OrgDocumentsResponse,
  OrgInvoicesResponse,
  OrgUsersResponse,
  Placement,
  Publisher,
  PublisherImportResult,
  PublisherInput,
  PublisherInventoryResponse,
  PublishersResponse,
  SessionUser,
  SubmissionPreviewResponse,
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

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>("/api/v1/admin/overview");
}

export async function fetchAdminSubmissions(filters?: {
  status?: string;
  organizationId?: string;
  creativeType?: string;
}): Promise<AdminSubmissionsResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.organizationId)
    params.set("organizationId", filters.organizationId);
  if (filters?.creativeType) params.set("creativeType", filters.creativeType);
  const qs = params.toString();
  return apiFetch<AdminSubmissionsResponse>(
    `/api/v1/admin/submissions${qs ? `?${qs}` : ""}`,
  );
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

export async function reactivateUser(userId: string): Promise<unknown> {
  return apiFetch(`/api/v1/users/${encodeURIComponent(userId)}/reactivate`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export async function removeMembership(membershipId: string): Promise<void> {
  await apiFetch(
    `/api/v1/memberships/${encodeURIComponent(membershipId)}`,
    { method: "DELETE" },
  );
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

export async function patchDocument(
  id: string,
  body: Partial<
    Pick<Document, "category" | "title" | "description">
  >,
): Promise<Document> {
  return apiFetch<Document>(`/api/v1/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
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
    budgetCents?: number;
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

export async function fetchSubmissionPreviewUrl(
  id: string,
): Promise<SubmissionPreviewResponse> {
  return apiFetch<SubmissionPreviewResponse>(
    `/api/v1/submissions/${encodeURIComponent(id)}/preview`,
  );
}

export async function fetchAccountRequests(
  init?: RequestInit,
): Promise<AccountRequestsResponse> {
  return apiFetch<AccountRequestsResponse>(
    "/api/v1/account-requests",
    init ?? {},
  );
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

// ── Publishers ──────────────────────────────────────────────────

export async function fetchPublishers(filters?: {
  q?: string;
  isActive?: boolean;
}): Promise<PublishersResponse> {
  const params = new URLSearchParams();
  if (filters?.q) params.set("q", filters.q);
  if (filters?.isActive !== undefined)
    params.set("isActive", String(filters.isActive));
  const qs = params.toString();
  return apiFetch<PublishersResponse>(
    `/api/v1/publishers${qs ? `?${qs}` : ""}`,
  );
}

export async function createPublisher(
  body: PublisherInput & { name: string },
): Promise<Publisher> {
  return apiFetch<Publisher>("/api/v1/publishers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchPublisher(
  id: string,
  body: PublisherInput,
): Promise<Publisher> {
  return apiFetch<Publisher>(
    `/api/v1/publishers/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deletePublisher(id: string): Promise<void> {
  await apiFetch(`/api/v1/publishers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function importPublishers(
  rows: Record<string, unknown>[],
): Promise<PublisherImportResult> {
  return apiFetch<PublisherImportResult>("/api/v1/publishers/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export async function geocodePublisher(id: string): Promise<Publisher> {
  return apiFetch<Publisher>(
    `/api/v1/publishers/${encodeURIComponent(id)}/geocode`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchCampaignPublishers(
  campaignId: string,
): Promise<CampaignPublishersResponse> {
  return apiFetch<CampaignPublishersResponse>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/publishers`,
  );
}

export async function addCampaignPublishers(
  campaignId: string,
  publisherIds: string[],
): Promise<{ added: number; requested: number }> {
  return apiFetch<{ added: number; requested: number }>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/publishers`,
    { method: "POST", body: JSON.stringify({ publisherIds }) },
  );
}

export async function removeCampaignPublisher(
  campaignId: string,
  publisherId: string,
): Promise<void> {
  await apiFetch(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/publishers/${encodeURIComponent(publisherId)}`,
    { method: "DELETE" },
  );
}

export async function fetchPublisherInventory(
  publisherId: string,
): Promise<PublisherInventoryResponse> {
  return apiFetch<PublisherInventoryResponse>(
    `/api/v1/publishers/${encodeURIComponent(publisherId)}/inventory`,
  );
}

export async function createInventory(
  publisherId: string,
  body: {
    name: string;
    mediaType: string;
    pricingModel?: string;
    rateCents?: number;
    description?: string;
  },
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(
    `/api/v1/publishers/${encodeURIComponent(publisherId)}/inventory`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function deleteInventory(inventoryId: string): Promise<void> {
  await apiFetch(
    `/api/v1/inventory/${encodeURIComponent(inventoryId)}`,
    { method: "DELETE" },
  );
}

export async function patchInventory(
  inventoryId: string,
  body: {
    name?: string;
    mediaType?: string;
    pricingModel?: string;
    rateCents?: number | null;
    description?: string | null;
    isActive?: boolean;
  },
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(
    `/api/v1/inventory/${encodeURIComponent(inventoryId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

// ── Placements ──────────────────────────────────────────────────

export async function fetchCampaignPlacements(
  campaignId: string,
): Promise<CampaignPlacementsResponse> {
  return apiFetch<CampaignPlacementsResponse>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/placements`,
  );
}

export async function createPlacement(
  campaignId: string,
  body: {
    inventoryId: string;
    name: string;
    status?: string;
    grossCostCents: number;
    netCostCents?: number;
    quantity?: number;
    notes?: string;
  },
): Promise<Placement> {
  return apiFetch<Placement>(
    `/api/v1/campaigns/${encodeURIComponent(campaignId)}/placements`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function patchPlacement(
  id: string,
  body: {
    name?: string;
    status?: string;
    grossCostCents?: number;
    netCostCents?: number | null;
    quantity?: number | null;
    notes?: string | null;
  },
): Promise<Placement> {
  return apiFetch<Placement>(
    `/api/v1/placements/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deletePlacement(id: string): Promise<void> {
  await apiFetch(`/api/v1/placements/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  return apiFetch<Campaign>(
    `/api/v1/campaigns/${encodeURIComponent(id)}`,
  );
}
