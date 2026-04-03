import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";

export type AuditMetadata = Prisma.InputJsonValue;

export type AuditWriteInput = {
  action: AuditAction;
  actorUserId: string;
  targetUserId?: string | null;
  organizationId?: string | null;
  metadata?: AuditMetadata;
};

type Tx = Pick<PrismaClient, "auditLog">;

/**
 * Persists one audit row. Use the same transaction as the mutating query when possible.
 */
export async function writeAuditLog(
  db: Tx,
  input: AuditWriteInput,
): Promise<void> {
  await db.auditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId ?? undefined,
      organizationId: input.organizationId ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}
