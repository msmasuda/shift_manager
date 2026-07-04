import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const logConfig =
  process.env.NODE_ENV === "development"
    ? ["query" as const, "error" as const, "warn" as const]
    : ["error" as const];

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL!;

  // Prisma Postgres (db.prisma.io) requires the Accelerate extension
  if (url.includes("prisma.io") || url.startsWith("prisma://")) {
    return new PrismaClient({ log: logConfig })
      .$extends(withAccelerate()) as unknown as PrismaClient;
  }

  // Direct PostgreSQL (local dev) — use the pg adapter
  const adapter = new PrismaPg(url);
  return new PrismaClient({ adapter, log: logConfig });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
