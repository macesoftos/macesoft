import "dotenv/config";
import prismaClientPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = prismaClientPackage;
const globalForPrisma = globalThis;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Use the Supabase session-pooler connection string.");
}

const databaseUrl = new URL(connectionString);
databaseUrl.searchParams.delete("sslmode");

const adapter = new PrismaPg({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: false },
});

export const prisma =
  globalForPrisma.macePrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.macePrisma = prisma;
}
