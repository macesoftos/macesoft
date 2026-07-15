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
const sslMode = databaseUrl.searchParams.get("sslmode");
const databaseSchema = databaseUrl.searchParams.get("schema") || "public";
databaseUrl.searchParams.delete("sslmode");
databaseUrl.searchParams.delete("schema");
const sslCa = String(process.env.DATABASE_SSL_CA || "").replace(/\\n/g, "\n");

const adapter = new PrismaPg({
  connectionString: databaseUrl.toString(),
  ssl: sslMode ? {
    rejectUnauthorized: process.env.NODE_ENV === "test"
      ? false
      : String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
    ...(sslCa ? { ca: sslCa } : {}),
  } : undefined,
}, { schema: databaseSchema });

export const prisma =
  globalForPrisma.macePrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.macePrisma = prisma;
}
