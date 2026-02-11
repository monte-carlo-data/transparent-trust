#!/usr/bin/env npx tsx
/**
 * Make a user an admin for local development
 *
 * Usage:
 *   npx tsx .local/make-admin.ts                    # Makes all users admin
 *   npx tsx .local/make-admin.ts user@example.com  # Makes specific user admin
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment files
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function makeAdmin(email?: string) {
  try {
    // Get or create default team
    let team = await prisma.team.findFirst({
      where: { slug: "default" },
    });

    if (!team) {
      console.log("Creating default team...");
      team = await prisma.team.create({
        data: {
          name: "Default",
          slug: "default",
          libraries: [],
        },
      });
      console.log(`Created team: ${team.name} (${team.id})`);
    }

    // Find users to make admin
    const whereClause = email ? { email: email.toLowerCase() } : {};
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        teamMemberships: true,
      },
    });

    if (users.length === 0) {
      if (email) {
        console.log(`\nNo user found with email: ${email}`);
        console.log("\nCreating new admin user...");

        const newUser = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            name: email.split("@")[0],
          },
        });

        await prisma.teamMembership.create({
          data: {
            userId: newUser.id,
            teamId: team.id,
            role: "admin",
          },
        });

        console.log(`✓ Created admin user: ${newUser.email}`);
      } else {
        console.log("\nNo users in database yet.");
        console.log("Sign in first, then run this script again.");
        console.log("\nOr create a user with: npx tsx .local/make-admin.ts your@email.com");
      }
      return;
    }

    console.log(`\nFound ${users.length} user(s):\n`);

    for (const user of users) {
      // Check if already has membership in default team
      const existingMembership = user.teamMemberships.find(
        (m) => m.teamId === team!.id
      );

      if (existingMembership) {
        if (existingMembership.role === "admin") {
          console.log(`✓ ${user.email} - already admin`);
        } else {
          // Update to admin
          await prisma.teamMembership.update({
            where: { id: existingMembership.id },
            data: { role: "admin" },
          });
          console.log(`✓ ${user.email} - upgraded to admin (was: ${existingMembership.role})`);
        }
      } else {
        // Create new admin membership
        await prisma.teamMembership.create({
          data: {
            userId: user.id,
            teamId: team.id,
            role: "admin",
          },
        });
        console.log(`✓ ${user.email} - added as admin`);
      }
    }

    console.log("\nDone! Refresh your browser and you should have admin access.");

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line args
const email = process.argv[2];
makeAdmin(email);
