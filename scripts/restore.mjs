import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { decryptFile, latestBackup, postgresEnvironment, run, safeBackupName, sha256 } from "./backup-lib.mjs";

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_URL or DATABASE_URL is required.");
const source = process.env.BACKUP_FILE ? resolve(process.env.BACKUP_FILE) : await latestBackup();
if (process.env.RESTORE_CONFIRM !== safeBackupName(source)) {
  throw new Error(`Set RESTORE_CONFIRM=${safeBackupName(source)} to confirm this destructive restore.`);
}
const manifest = JSON.parse(await fs.readFile(`${source}.json`, "utf8"));
if (manifest.sha256 !== await sha256(source)) throw new Error("Backup checksum verification failed.");
const temporary = resolve(tmpdir(), `${safeBackupName(source)}.${process.pid}.restore.dump`);
try {
  await decryptFile(source, temporary);
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", temporary], {
    env: postgresEnvironment(databaseUrl),
  });
  console.log(JSON.stringify({ event: "restore_completed", file: source }));
} finally {
  await fs.unlink(temporary).catch(() => {});
}
