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

export interface DocumentDownloadResponse {
  url: string;
  filename: string;
  mimeType: string;
}

export type CampaignStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export interface Campaign {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: CampaignStatus;
  budgetCents: number | null;
  startDate: string | null;
  endDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgCampaignsResponse {
  organizationId: string;
  campaigns: Campaign[];
}

export type MediaType = "PRINT" | "DIGITAL" | "EMAIL" | "OTHER";

export type PricingModel =
  | "CPM"
  | "VCPM"
  | "CPC"
  | "CPCV"
  | "FLAT"
  | "COLUMN_INCH"
  | "PER_LINE"
  | "OTHER";

export type PlacementStatus =
  | "DRAFT"
  | "BOOKED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED";

export interface Placement {
  id: string;
  campaignId: string;
  inventoryId: string;
  name: string;
  status: PlacementStatus;
  grossCostCents: number;
  quantity: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  inventory: {
    id: string;
    name: string;
    mediaType: MediaType;
    pricingModel: PricingModel;
    publisher: {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
    };
  };
}

export interface CampaignPlacementsResponse {
  campaignId: string;
  placements: Placement[];
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
}

export interface OrgInvoicesResponse {
  organizationId: string;
  invoices: Invoice[];
}

export type CreativeType = "PRINT" | "DIGITAL";

export type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REVISION_REQUESTED";

export interface CreativeSubmission {
  id: string;
  campaignId: string;
  organizationId: string;
  title: string;
  description: string | null;
  creativeType: CreativeType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  status: SubmissionStatus;
  reviewNote: string | null;
  submittedById: string;
  createdAt: string;
  updatedAt: string;
  submittedBy?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface CampaignSubmissionsResponse {
  campaignId: string;
  submissions: CreativeSubmission[];
}

export interface SubmissionDownloadResponse {
  url: string;
  filename: string;
  mimeType: string;
}
