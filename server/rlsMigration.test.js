import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const migrationsRoot = join(root, "prisma", "migrations");
const migrationSql = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(migrationsRoot, entry.name, "migration.sql"))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const modelTables = [...schema.matchAll(/^model\s+([A-Za-z0-9_]+)\s+\{/gm)]
  .map((match) => match[1]);

test("every public Prisma table has row-level security enabled by migrations", () => {
  for (const table of [...modelTables, "_prisma_migrations"]) {
    assert.ok(
      migrationSql.includes(`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY;`),
      `Missing RLS migration for public.${table}`,
    );
    assert.ok(
      migrationSql.includes(`CREATE POLICY "deny_direct_api_access" ON "public"."${table}" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);`),
      `Missing restrictive direct-API policy for public.${table}`,
    );
  }
});
