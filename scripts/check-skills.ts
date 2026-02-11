#!/usr/bin/env tsx

/**
 * Quick script to check existing skills in the database
 */

import { prisma } from "../src/lib/prisma";

async function checkSkills() {
  const skills = await prisma.skill.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log(`\n📊 Found ${skills.length} active skills:\n`);

  skills.forEach((skill, i) => {
    console.log(`${i + 1}. ${skill.title}`);
    console.log(`   Status: ${skill.status}`);
    console.log(`   Created: ${skill.createdAt.toISOString()}`);
    console.log(`   ID: ${skill.id}\n`);
  });

  if (skills.length === 0) {
    console.log("No skills found. You can:");
    console.log("  1. Create a skill via the web UI at http://localhost:3000/knowledge/add");
    console.log("  2. It will automatically commit to git!\n");
  }
}

checkSkills()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
