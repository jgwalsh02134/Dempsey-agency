import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import {
  publisherIdParamsSchema,
  createPublisherSchema,
  updatePublisherSchema,
  importPublishersSchema,
  createInventorySchema,
  updateInventorySchema,
  inventoryIdParamsSchema,
} from "./schemas.js";

const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export async function publisherRoutes(app: FastifyInstance) {
  // ── List publishers (agency staff+) ──────────────────────────
  app.get(
    "/publishers",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"),
      ],
    },
    async (request) => {
      const { q, isActive } = listQuerySchema.parse(request.query);

      const where: Record<string, unknown> = {};
      if (isActive !== undefined) where.isActive = isActive;
      if (q && q.length > 0) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { state: { contains: q, mode: "insensitive" } },
          { parentCompany: { contains: q, mode: "insensitive" } },
        ];
      }

      const publishers = await app.prisma.publisher.findMany({
        where,
        orderBy: { name: "asc" },
        include: { _count: { select: { inventory: true } } },
      });
      return { publishers };
    },
  );

  // ── Create publisher (agency admin+) ─────────────────────────
  app.post(
    "/publishers",
    {
      preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
    },
    async (request, reply) => {
      const parsed = createPublisherSchema.parse(request.body);
      const publisher = await app.prisma.publisher.create({ data: parsed });
      return reply.code(201).send(publisher);
    },
  );

  // ── Update publisher (agency admin+) ─────────────────────────
  app.patch(
    "/publishers/:id",
    {
      preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
    },
    async (request, reply) => {
      const { id } = publisherIdParamsSchema.parse(request.params);

      const existing = await app.prisma.publisher.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: "Publisher not found" });
      }

      const parsed = updatePublisherSchema.parse(request.body);
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined) data[key] = value;
      }

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await app.prisma.publisher.update({
        where: { id },
        data,
      });
      return updated;
    },
  );

  // ── Bulk import publishers (agency admin+) ───────────────────
  //
  // Client parses CSV and POSTs { rows: [{...}, ...] }.
  // Duplicate rule (v1): case-insensitive match on (name, city, state).
  //   match → UPDATE existing (fills in nulls; does not overwrite isActive)
  //   no match → CREATE
  // Rows failing validation are skipped with row-level errors returned.
  app.post(
    "/publishers/import",
    {
      preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
    },
    async (request, reply) => {
      const { rows } = importPublishersSchema.parse(request.body);

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const parsed = createPublisherSchema.safeParse(raw);
        if (!parsed.success) {
          skipped += 1;
          const first = parsed.error.issues[0];
          errors.push({
            row: i + 1,
            message: first
              ? `${first.path.join(".") || "row"}: ${first.message}`
              : "Invalid row",
          });
          continue;
        }

        const data = parsed.data;

        // Duplicate match: case-insensitive (name, city, state).
        const match = await app.prisma.publisher.findFirst({
          where: {
            name: { equals: data.name, mode: "insensitive" },
            city: data.city
              ? { equals: data.city, mode: "insensitive" }
              : null,
            state: data.state
              ? { equals: data.state, mode: "insensitive" }
              : null,
          },
          select: { id: true },
        });

        try {
          if (match) {
            // Merge-fill only: set fields that are provided; skip isActive
            // to avoid accidentally reactivating disabled publishers.
            const mergeData: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
              if (key === "isActive") continue;
              if (value !== undefined) mergeData[key] = value;
            }
            await app.prisma.publisher.update({
              where: { id: match.id },
              data: mergeData,
            });
            updated += 1;
          } else {
            await app.prisma.publisher.create({ data });
            created += 1;
          }
        } catch (err) {
          skipped += 1;
          errors.push({
            row: i + 1,
            message:
              err instanceof Error ? err.message : "Failed to save row",
          });
        }
      }

      return reply.code(200).send({
        total: rows.length,
        created,
        updated,
        skipped,
        errors,
      });
    },
  );

  // ── List inventory for a publisher (agency staff+) ───────────
  app.get(
    "/publishers/:id/inventory",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"),
      ],
    },
    async (request, reply) => {
      const { id } = publisherIdParamsSchema.parse(request.params);

      const publisher = await app.prisma.publisher.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!publisher) {
        return reply.code(404).send({ error: "Publisher not found" });
      }

      const inventory = await app.prisma.inventory.findMany({
        where: { publisherId: id },
        orderBy: { name: "asc" },
      });
      return { publisherId: id, inventory };
    },
  );

  // ── Create inventory item (agency admin+) ────────────────────
  app.post(
    "/publishers/:id/inventory",
    {
      preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
    },
    async (request, reply) => {
      const { id } = publisherIdParamsSchema.parse(request.params);

      const publisher = await app.prisma.publisher.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!publisher) {
        return reply.code(404).send({ error: "Publisher not found" });
      }

      const parsed = createInventorySchema.parse(request.body);
      const item = await app.prisma.inventory.create({
        data: { ...parsed, publisherId: id },
      });
      return reply.code(201).send(item);
    },
  );

  // ── Update inventory item (agency admin+) ────────────────────
  app.patch(
    "/inventory/:inventoryId",
    {
      preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
    },
    async (request, reply) => {
      const { inventoryId } = inventoryIdParamsSchema.parse(request.params);

      const existing = await app.prisma.inventory.findUnique({
        where: { id: inventoryId },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Inventory item not found" });
      }

      const parsed = updateInventorySchema.parse(request.body);
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined) data[key] = value;
      }

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await app.prisma.inventory.update({
        where: { id: inventoryId },
        data,
      });
      return updated;
    },
  );
}
