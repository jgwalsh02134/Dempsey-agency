import type { FastifyInstance } from "fastify";
import type { AuditAction, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";

const agencyAdmin = {
  preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
};

const SENSITIVE_KEY = /password|hash|token|secret/i;

function sanitizeMetadata(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, Prisma.JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key) || child === undefined) continue;
      out[key] = sanitizeMetadata(child);
    }
    return out;
  }
  return value;
}

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const auditQuerySchema = z.object({
  action: z.preprocess(
    blankToUndefined,
    z
      .enum([
        "USER_CREATED",
        "ROLE_CHANGED",
        "USER_DEACTIVATED",
        "MEMBERSHIP_REMOVED",
      ])
      .optional(),
  ),
  actorUserId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  organizationId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  from: z.preprocess(blankToUndefined, z.coerce.date().optional()),
  to: z.preprocess(blankToUndefined, z.coerce.date().optional()),
  page: z.preprocess(
    (value) => blankToUndefined(value) ?? "1",
    z.coerce.number().int().min(1),
  ),
  limit: z.preprocess(
    (value) => blankToUndefined(value) ?? "25",
    z.coerce.number().int().min(1).max(100),
  ),
});

const submissionsQuerySchema = z.object({
  status: z.preprocess(
    blankToUndefined,
    z
      .enum([
        "UPLOADED",
        "VALIDATION_FAILED",
        "UNDER_REVIEW",
        "NEEDS_RESIZING",
        "READY_FOR_PUBLISHER",
        "PUSHED",
      ])
      .optional(),
  ),
  organizationId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  creativeType: z.preprocess(
    blankToUndefined,
    z.enum(["PRINT", "DIGITAL", "MASTER_ASSET"]).optional(),
  ),
});

const STATUS_SORT: Record<string, number> = {
  VALIDATION_FAILED: 0,
  UPLOADED: 1,
  UNDER_REVIEW: 2,
  NEEDS_RESIZING: 3,
  READY_FOR_PUBLISHER: 4,
  PUSHED: 5,
};

export async function adminRoutes(app: FastifyInstance) {
  app.get("/overview", agencyAdmin, async () => {
    const prisma = app.prisma;

    const [
      activeClients,
      activeCampaigns,
      pendingReviews,
      pendingRequests,
      overdueInvoices,
      recentActivity,
    ] = await Promise.all([
      prisma.organization.count({ where: { type: "CLIENT" } }),
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.creativeSubmission.count({
        where: { status: { in: ["UPLOADED", "VALIDATION_FAILED"] } },
      }),
      prisma.accountRequest.count({ where: { status: "PENDING" } }),
      prisma.invoice.count({ where: { status: "OVERDUE" } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          actorUser: { select: { id: true, email: true, name: true } },
          targetUser: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    return {
      activeClients,
      activeCampaigns,
      pendingReviews,
      pendingRequests,
      overdueInvoices,
      recentActivity: recentActivity.map((row) => ({
        ...row,
        metadata: row.metadata ? sanitizeMetadata(row.metadata) : null,
      })),
    };
  });

  app.get("/audit-logs", agencyAdmin, async (request) => {
    const query = auditQuerySchema.parse(request.query);
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action as AuditAction;
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const [total, rows] = await Promise.all([
      app.prisma.auditLog.count({ where }),
      app.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          actorUser: { select: { id: true, email: true, name: true } },
          targetUser: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    return {
      page: query.page,
      limit: query.limit,
      total,
      logs: rows.map((row) => ({
        ...row,
        metadata: row.metadata ? sanitizeMetadata(row.metadata) : null,
      })),
    };
  });

  app.get("/submissions", agencyAdmin, async (request) => {
    const query = submissionsQuerySchema.parse(request.query);

    const where: Prisma.CreativeSubmissionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.creativeType) where.creativeType = query.creativeType;

    const submissions = await app.prisma.creativeSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        submittedBy: { select: { id: true, email: true, name: true } },
        campaign: { select: { id: true, title: true, status: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    submissions.sort(
      (a, b) =>
        (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { submissions };
  });
}
