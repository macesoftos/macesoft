import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 3199;
const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer(process) {
  let output = "";
  process.stdout.on("data", (chunk) => { output += chunk; });
  process.stderr.on("data", (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`API exited before boundary test:\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/api/bootstrap`);
      return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`API did not start for boundary test:\n${output}`);
}

test("real API denies private data reads before touching the database", async () => {
  const api = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      API_PORT: String(port),
      DATABASE_URL: "postgresql://boundary:boundary@127.0.0.1:1/boundary",
      DIRECT_URL: "postgresql://boundary:boundary@127.0.0.1:1/boundary",
      ENABLE_DEMO_ACCOUNTS: "false",
      API_ALLOW_TRUSTED_HEADERS: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const bootstrap = await waitForServer(api);
    assert.equal(bootstrap.status, 401);
    assert.match(bootstrap.headers.get("cache-control") || "", /no-store/);
    assert.deepEqual(await bootstrap.json(), { error: "Authentication is required." });

    const clients = await fetch(`${baseUrl}/api/clients`);
    assert.equal(clients.status, 401);

    const settings = await fetch(`${baseUrl}/api/settings`);
    assert.equal(settings.status, 401);
  } finally {
    api.kill("SIGTERM");
    await new Promise((resolve) => api.once("exit", resolve));
  }
});
