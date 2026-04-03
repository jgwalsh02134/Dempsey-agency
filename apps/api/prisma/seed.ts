import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = process.env.SEED_EMAIL || "admin@dempsey.agency";
  const password = process.env.SEED_PASSWORD || "changeme123";
  const orgName = process.env.SEED_ORG_NAME || "Dempsey Agency";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Agency Owner", passwordHash },
  });

  let org = await prisma.organization.findFirst({
    where: { name: orgName, type: "AGENCY" },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: orgName, type: "AGENCY" },
    });
  }

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: { role: "AGENCY_OWNER" },
    create: {
      userId: user.id,
      organizationId: org.id,
      role: "AGENCY_OWNER",
    },
  });

  console.log(`Seeded: ${email} as AGENCY_OWNER of "${orgName}"`);
  console.log(`Password: ${password}`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
