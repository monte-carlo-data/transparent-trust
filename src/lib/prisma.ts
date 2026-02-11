import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "./database-url";

// Singleton pattern for Prisma Client to avoid multiple instances in development
// https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = ensureDatabaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: databaseUrl
    ? {
        db: { url: databaseUrl },
      }
    : undefined,
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
