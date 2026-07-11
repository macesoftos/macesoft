import prismaClientPackage from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const { PrismaClient } = prismaClientPackage;
const globalForPrisma = globalThis;
const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });

export const prisma =
  globalForPrisma.macePrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.macePrisma = prisma;
}
