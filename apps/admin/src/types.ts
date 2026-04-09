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

/** One row in GET /organizations/:id/users → users[]. */
export type OrgMemberRow = OrgUsersResponse["users"][number];

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; name: string | null };
}

export interface Document {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface OrgDocumentsResponse {
  organizationId: string;
  documents: Document[];
}

export type CampaignStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export interface Campaign {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface OrgCampaignsResponse {
  organizationId: string;
  campaigns: Campaign[];
}

export type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE";

export interface Invoice {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface OrgInvoicesResponse {
  organizationId: string;
  invoices: Invoice[];
}
