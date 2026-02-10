/**
 * Minimal seed for Platform V2 (CommonJS for runtime compatibility).
 * - Creates the default team only (no sample data).
 * - Okta/SSO logins will create users and memberships on first login.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Team",
      slug: "default",
      description: "Default team for all users",
      libraries: ["knowledge", "it", "gtm", "customers", "prompts", "personas", "templates"],
      settings: { allowPublicBlocks: true },
    },
  });

  console.log(`✓ Default team ready (${team.id})`);

  // Create Slack integration connections for each library
  // These allow users to configure which channels to monitor via the UI
  const slackLibraries = [
    { libraryId: "it", name: "IT Support Slack" },
    { libraryId: "knowledge", name: "Knowledge Slack" },
    { libraryId: "gtm", name: "GTM Slack" },
    { libraryId: "customers", name: "Customers Slack" },
  ];

  for (const { libraryId, name } of slackLibraries) {
    await prisma.integrationConnection.upsert({
      where: { id: `slack-${libraryId}` },
      update: {},
      create: {
        id: `slack-${libraryId}`,
        integrationType: "slack",
        name,
        status: "ACTIVE",
        config: { channels: [] }, // Users configure channels via UI
      },
    });
    console.log(`✓ Slack integration "${name}" ready`);
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
