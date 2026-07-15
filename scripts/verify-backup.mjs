import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { decryptFile, latestBackup, run, safeBackupName, sha256 } from "./backup-lib.mjs";

const source = process.env.BACKUP_FILE ? resolve(process.env.BACKUP_FILE) : await latestBackup();
const manifest = JSON.parse(await fs.readFile(`${source}.json`, "utf8"));
const actualHash = await sha256(source);
if (manifest.sha256 !== actualHash) throw new Error("Backup checksum verification failed.");
const temporary = resolve(tmpdir(), `${safeBackupName(source)}.${process.pid}.verify.dump`);
try {
  await decryptFile(source, temporary);
  await run("pg_restore", ["--list", temporary]);
  console.log(JSON.stringify({ event: "backup_verified", file: source, sha256: actualHash }));
} finally {
  await fs.unlink(temporary).catch(() => {});
}
