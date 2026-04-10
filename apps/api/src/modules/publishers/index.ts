import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import {
  publisherIdParamsSchema,
  createPublisherSchema,
  updatePublisherSchema,
  createInventorySchema,
  updateInventorySchema,
  inventoryIdParamsSchema,
} from "./schemas.js";

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
    async () => {
      const publishers = await app.prisma.publisher.findMany({
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
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
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
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async (request, reply) => {
      const { id } = publisherIdParamsSchema.parse(request.params);

      const existing = await app.prisma.publisher.findUnique({
        where: { id },
      });
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
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
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
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
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
