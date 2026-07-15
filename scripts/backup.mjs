import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import {
  backupDirectory,
  encryptFile,
  postgresEnvironment,
  run,
  sha256,
} from "./backup-lib.mjs";

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_URL or DATABASE_URL is required.");
const directory = backupDirectory();
await fs.mkdir(directory, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const temporary = resolve(directory, `.macesoft-${stamp}.dump.tmp`);
const encrypted = resolve(directory, `macesoft-${stamp}.dump.enc`);

try {
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", `--file=${temporary}`], {
    env: postgresEnvironment(databaseUrl),
  });
  await encryptFile(temporary, encrypted);
  const manifest = {
    format: "macesoft-aes-256-gcm-v1",
    createdAt: new Date().toISOString(),
    file: encrypted.split(/[\\/]/).pop(),
    sha256: await sha256(encrypted),
  };
  await fs.writeFile(`${encrypted}.json`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const retentionDays = Math.max(7, Number(process.env.BACKUP_RETENTION_DAYS || 30));
  const cutoff = Date.now() - retentionDays * 86_400_000;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^macesoft-.*\.dump\.enc(?:\.json)?$/.test(entry.name)) continue;
    const file = resolve(directory, entry.name);
    if ((await fs.stat(file)).mtimeMs < cutoff) await fs.unlink(file);
  }
  console.log(JSON.stringify({ event: "backup_completed", file: encrypted, sha256: manifest.sha256 }));
} finally {
  await fs.unlink(temporary).catch(() => {});
}
