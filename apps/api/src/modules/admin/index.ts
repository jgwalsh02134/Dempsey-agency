import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";

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
}
