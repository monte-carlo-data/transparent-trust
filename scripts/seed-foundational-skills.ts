/**
 * Seed Foundational Skills
 *
 * Creates the default set of foundational skills for customer intelligence.
 * Run with: npx tsx scripts/seed-foundational-skills.ts
 */

import { PrismaClient } from '@prisma/client';
import seedFoundationalSkills from '../prisma/seeds/foundational-skills';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting foundational skills seed...\n');

  // Get the first team (or prompt for team ID)
  const team = await prisma.team.findFirst({
    include: {
      members: {
        where: {
          role: { in: ['OWNER', 'ADMIN'] },
        },
        take: 1,
      },
    },
  });

  if (!team) {
    throw new Error('No team found. Please create a team first.');
  }

  const userId = team.members[0]?.userId;
  if (!userId) {
    throw new Error('No admin user found for team. Please add a team member.');
  }

  console.log(`Using team: ${team.name} (${team.id})`);
  console.log(`Owner: ${userId}\n`);

  await seedFoundationalSkills(team.id, userId);

  console.log('\n✅ Foundational skills seeded successfully!');
  console.log('View them at: /v2/customers (Foundational Skills tab)');
}

main()
  .catch((error) => {
    console.error('Error seeding foundational skills:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
