export type Role =
  | "AGENCY_OWNER"
  | "AGENCY_ADMIN"
  | "STAFF"
  | "CLIENT_ADMIN"
  | "CLIENT_USER";

export type OrganizationType = "AGENCY" | "CLIENT";

export interface SessionMembership {
  id: string;
  organizationId: string;
  role: Role;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  memberships: SessionMembership[];
}

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  createdAt: string;
  updatedAt: string;
}

export interface OrgUsersResponse {
  organizationId: string;
  users: {
    membershipId: string;
    role: Role;
    joinedAt: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      active: boolean;
    };
  }[];
}

/** Response body from PATCH /api/v1/users/:id/role (membership + user). */
export interface PatchUserRoleResponse {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    active: boolean;
  };
}

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; name: string | null };
}
