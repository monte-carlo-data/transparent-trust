#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";

async function checkUser() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });

  console.log("\n📊 Users in database:");
  users.forEach((user) => {
    console.log(`  - ${user.email} (${user.name || "No name"})`);
    console.log(`    ID: ${user.id}`);
  });

  if (users.length === 0) {
    console.log("\n⚠️  No users found!");
    console.log("You need to log in at http://localhost:3000 first to create your user.");
  }
}

checkUser()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
