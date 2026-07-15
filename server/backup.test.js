import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { decryptFile, encryptFile, sha256 } from "../scripts/backup-lib.mjs";

test("database backup encryption round-trips and detects tampering", async () => {
  process.env.BACKUP_ENCRYPTION_KEY = "unit-test-backup-key-with-32-characters";
  const prefix = resolve(tmpdir(), `macesoft-backup-${process.pid}-${Date.now()}`);
  const source = `${prefix}.dump`;
  const encrypted = `${prefix}.dump.enc`;
  const restored = `${prefix}.restored`;
  try {
    const payload = Buffer.from("representative PostgreSQL custom-format payload\n".repeat(200));
    await fs.writeFile(source, payload);
    await encryptFile(source, encrypted);
    assert.notEqual(await sha256(source), await sha256(encrypted));
    await decryptFile(encrypted, restored);
    assert.deepEqual(await fs.readFile(restored), payload);

    const damaged = await fs.readFile(encrypted);
    damaged[Math.floor(damaged.length / 2)] ^= 0xff;
    await fs.writeFile(encrypted, damaged);
    await assert.rejects(() => decryptFile(encrypted, restored));
  } finally {
    await Promise.all([source, encrypted, restored].map((file) => fs.unlink(file).catch(() => {})));
  }
});
