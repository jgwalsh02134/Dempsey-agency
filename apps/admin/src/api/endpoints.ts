import { apiFetch } from "./client";
import type {
  Document,
  LoginResponse,
  Organization,
  OrgDocumentsResponse,
  OrgUsersResponse,
  SessionUser,
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
