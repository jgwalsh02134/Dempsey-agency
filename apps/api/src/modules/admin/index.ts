import type { FastifyInstance } from "fastify";
import type { SubmissionStatus } from "@prisma/client";
import { requireAuth } from "../../plugins/auth.js";

const STATUS_SORT: Record<string, number> = {
  SUBMITTED: 0,
  REVISION_REQUESTED: 1,
  APPROVED: 2,
};

export async function adminRoutes(app: FastifyInstance) {
  app.get("/overview", { preHandler: [requireAuth] }, async (request) => {
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
      prisma.creativeSubmission.count({ where: { status: "SUBMITTED" } }),
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
      recentActivity,
    };
  });

  app.get("/submissions", { preHandler: [requireAuth] }, async (request) => {
    const query = request.query as {
      status?: string;
      organizationId?: string;
      creativeType?: string;
    };

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status as SubmissionStatus;
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
