import "dotenv/config";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { productionConfigErrors } from "../server/productionConfig.js";

const checks = [];
function check(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail });
}

for (const file of [
  "Dockerfile",
  ".github/workflows/ci.yml",
  "prisma/migrations/20260711000000_baseline/migration.sql",
  "docs/PRODUCTION_RUNBOOK.md",
  "scripts/backup.mjs",
  "scripts/verify-backup.mjs",
  "scripts/restore.mjs",
]) check(`file:${file}`, existsSync(file), existsSync(file) ? "present" : "missing");

for (const command of ["pg_dump", "pg_restore"]) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" });
  check(`binary:${command}`, result.status === 0, (result.stdout || result.stderr || "not found").trim());
}

const configErrors = productionConfigErrors({ ...process.env, NODE_ENV: "production" });
check("production-environment", configErrors.length === 0, configErrors.length ? configErrors.join(" ") : "secure configuration complete");
check("backup-directory", Boolean(process.env.BACKUP_DIRECTORY), process.env.BACKUP_DIRECTORY || "BACKUP_DIRECTORY is missing");
check("backup-encryption", String(process.env.BACKUP_ENCRYPTION_KEY || "").length >= 32, "BACKUP_ENCRYPTION_KEY must be 32+ characters");

const passed = checks.filter((item) => item.passed).length;
const score = Math.round((passed / checks.length) * 100);
console.log(JSON.stringify({ score, passed, total: checks.length, checks }, null, 2));
if (score !== 100) process.exitCode = 1;
