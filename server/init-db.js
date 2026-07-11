import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dbPath = resolve("prisma/dev.db");
const sqlPath = resolve("prisma/init.sql");

if (!existsSync(sqlPath)) {
  throw new Error("Missing prisma/init.sql. Run `pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/init.sql` first.");
}

mkdirSync(dirname(dbPath), { recursive: true });

if (existsSync(dbPath)) {
  rmSync(dbPath);
}

const sql = readFileSync(sqlPath, "utf8");
const database = new DatabaseSync(dbPath);

try {
  database.exec("PRAGMA foreign_keys = OFF;");
  database.exec(sql);
  database.exec("PRAGMA foreign_keys = ON;");
  console.log(`SQLite schema initialized at ${dbPath}`);
} finally {
  database.close();
}
