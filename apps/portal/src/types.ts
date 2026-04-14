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

export type DocumentCategory =
  | "PROOF"
  | "INVOICE"
  | "INSERTION_ORDER"
  | "CONTRACT"
  | "CREATIVE_ASSET"
  | "OTHER";

export interface Document {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  category: DocumentCategory;
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

export type NotificationType =
  | "CREATIVE_REVISION_REQUESTED"
  | "CREATIVE_REVISION_UPLOADED"
  | "PLACEMENT_AWAITING_APPROVAL"
  | "PLACEMENT_APPROVED_BY_CLIENT"
  | "NEW_INVOICE_UPLOADED"
  | "NEW_PROOF_UPLOADED";

export type NotificationLink =
  | { type: "CAMPAIGN"; campaignId: string }
  | { type: "DOCUMENTS" }
  | null;

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
  link: NotificationLink;
}

export interface NotificationsResponse {
  notifications: Notification[];
}

export interface UnreadCountResponse {
  count: number;
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

export type PlacementClientResponse =
  | "PENDING_CLIENT_REVIEW"
  | "CLIENT_APPROVED";

export interface Placement {
  id: string;
  campaignId: string;
  inventoryId: string;
  name: string;
  status: PlacementStatus;
  grossCostCents: number;
  quantity: number | null;
  notes: string | null;
  clientResponse: PlacementClientResponse;
  clientResponseNote: string | null;
  clientRespondedAt: string | null;
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
      dmaName: string | null;
      dmaCode: string | null;
    };
  };
}

export interface CampaignPlacementsResponse {
  campaignId: string;
  placements: Placement[];
}

/** Publisher shape returned for the campaign-scoped map. */
export interface CampaignMapPublisher {
  linkId: string;
  notes: string | null;
  id: string;
  name: string;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: string | null;
}

export interface CampaignPublishersResponse {
  campaignId: string;
  publishers: CampaignMapPublisher[];
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
  parentSubmissionId: string | null;
  version: number;
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

export interface SubmissionPreviewResponse {
  url: string;
  mimeType: string;
  previewable: boolean;
}
