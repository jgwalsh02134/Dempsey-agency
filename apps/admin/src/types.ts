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
  budgetCents: number | null;
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
  organization?: {
    id: string;
    name: string;
    type: OrganizationType;
  };
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

export interface Publisher {
  id: string;
  name: string;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  county: string | null;
  country: string | null;
  phone: string | null;
  frequency: string | null;
  circulation: number | null;
  yearEstablished: number | null;
  officeHours: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  generalEmail: string | null;
  transactionEmail: string | null;
  corporateEmail: string | null;
  contactName: string | null;
  parentCompany: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { inventory: number };
}

/** Writeable publisher fields — shared shape for create and update bodies. */
export interface PublisherInput {
  name?: string;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  county?: string | null;
  country?: string | null;
  phone?: string | null;
  frequency?: string | null;
  circulation?: number | null;
  yearEstablished?: number | null;
  officeHours?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  generalEmail?: string | null;
  transactionEmail?: string | null;
  corporateEmail?: string | null;
  contactName?: string | null;
  parentCompany?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface PublishersResponse {
  publishers: Publisher[];
}

export interface PublisherImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export interface InventoryItem {
  id: string;
  publisherId: string;
  name: string;
  mediaType: MediaType;
  pricingModel: PricingModel;
  rateCents: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublisherInventoryResponse {
  publisherId: string;
  inventory: InventoryItem[];
}

export interface Placement {
  id: string;
  campaignId: string;
  inventoryId: string;
  name: string;
  status: PlacementStatus;
  grossCostCents: number;
  netCostCents: number | null;
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

export type CreativeType = "PRINT" | "DIGITAL" | "MASTER_ASSET";

export type SubmissionStatus =
  | "UPLOADED"
  | "VALIDATION_FAILED"
  | "UNDER_REVIEW"
  | "NEEDS_RESIZING"
  | "READY_FOR_PUBLISHER"
  | "PUSHED";

export interface ValidationSummary {
  passed: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    widthPx: number | null;
    heightPx: number | null;
    dpi: number | null;
    colorSpace: string | null;
  };
}

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
  placementId: string | null;
  widthPx: number | null;
  heightPx: number | null;
  dpi: number | null;
  colorSpace: string | null;
  validationSummary: ValidationSummary | null;
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

export type AccountRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AccountRequest {
  id: string;
  email: string;
  name: string;
  company: string;
  message: string | null;
  status: AccountRequestStatus;
  reviewedById: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export interface AccountRequestsResponse {
  requests: AccountRequest[];
}

export interface InviteStub {
  token: string;
  expiresAt: string;
}

export interface AccountRequestWithInvite extends AccountRequest {
  invite?: InviteStub;
}

export interface AICreativeReview {
  verdict: "approve" | "revise" | "reject";
  summary: string;
  issues: string[];
  suggestions: string[];
  nextAction: string;
}

export interface SubmissionPreviewResponse {
  url: string;
  mimeType: string;
  previewable: boolean;
}

export interface AdminSubmission extends CreativeSubmission {
  campaign: { id: string; title: string; status: CampaignStatus };
  organization: { id: string; name: string };
}

export interface AdminSubmissionsResponse {
  submissions: AdminSubmission[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  targetUserId: string | null;
  organizationId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUser: { id: string; email: string; name: string | null } | null;
  targetUser: { id: string; email: string; name: string | null } | null;
}

export interface AdminOverview {
  activeClients: number;
  activeCampaigns: number;
  pendingReviews: number;
  pendingRequests: number;
  overdueInvoices: number;
  recentActivity: AuditLogEntry[];
}
