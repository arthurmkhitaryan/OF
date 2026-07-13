import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

/** Cached client can be stale after schema changes in dev — recreate if models missing */
function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  const clientOk =
    cached &&
    typeof (cached as PrismaClient & { account?: unknown }).account !== "undefined" &&
    typeof (cached as PrismaClient & { gexSnapshot?: unknown }).gexSnapshot !== "undefined";

  if (clientOk) return cached;

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();
