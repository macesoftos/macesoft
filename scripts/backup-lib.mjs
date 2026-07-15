import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { basename, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const MAGIC = Buffer.from("MACEBK1\n", "ascii");

export function backupDirectory() {
  return resolve(process.env.BACKUP_DIRECTORY || "backups");
}

export function encryptionKey() {
  const secret = String(process.env.BACKUP_ENCRYPTION_KEY || "");
  if (secret.length < 32) throw new Error("BACKUP_ENCRYPTION_KEY must contain at least 32 characters.");
  return createHash("sha256").update(secret).digest();
}

export function postgresEnvironment(connectionString) {
  const url = new URL(connectionString);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, ""),
    PGSSLMODE: url.searchParams.get("sslmode") || "require",
  };
}

export function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise(undefined) : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

export async function encryptFile(source, target) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  await fs.writeFile(target, Buffer.concat([MAGIC, iv]), { mode: 0o600 });
  await pipeline(createReadStream(source), cipher, createWriteStream(target, { flags: "a", mode: 0o600 }));
  await fs.appendFile(target, cipher.getAuthTag());
}

export async function decryptFile(source, target) {
  const handle = await fs.open(source, "r");
  try {
    const stat = await handle.stat();
    if (stat.size <= MAGIC.length + 12 + 16) throw new Error("Backup file is incomplete.");
    const header = Buffer.alloc(MAGIC.length + 12);
    await handle.read(header, 0, header.length, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Backup file header is invalid.");
    const tag = Buffer.alloc(16);
    await handle.read(tag, 0, 16, stat.size - 16);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), header.subarray(MAGIC.length));
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(source, { start: header.length, end: stat.size - 17 }),
      decipher,
      createWriteStream(target, { mode: 0o600 }),
    );
  } finally {
    await handle.close();
  }
}

export async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function latestBackup() {
  const directory = backupDirectory();
  const entries = (await fs.readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".dump.enc"))
    .map((entry) => resolve(directory, entry.name));
  if (!entries.length) throw new Error(`No encrypted backups found in ${directory}.`);
  const dated = await Promise.all(entries.map(async (file) => ({ file, stat: await fs.stat(file) })));
  return dated.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0].file;
}

export function selectedBackup() {
  return process.env.BACKUP_FILE ? resolve(process.env.BACKUP_FILE) : latestBackup();
}

export function safeBackupName(file) {
  return basename(file).replace(/[^A-Za-z0-9_.-]/g, "_");
}
