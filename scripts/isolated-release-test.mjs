import "dotenv/config";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import pg from "pg";

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
if (!directUrl || !runtimeUrl) throw new Error("DATABASE_URL and DIRECT_URL are required for isolated release testing.");
const schema = `codex_release_${Date.now()}_${process.pid}`;
const isolatedApiPort = process.env.ISOLATED_API_PORT || "3198";
const isolatedWebPort = process.env.ISOLATED_WEB_PORT || "5187";
const isolatedOrigin = `http://127.0.0.1:${isolatedWebPort}`;
const isolatedStorageBucket = "isolated-release-assets";
const isolatedStorageObjects = new Map();

const isolatedStorageServer = createServer((request, response) => {
  const prefix = `/storage/v1/object/${isolatedStorageBucket}/`;
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  if (!pathname.startsWith(prefix)) {
    response.writeHead(404).end();
    return;
  }
  const key = decodeURIComponent(pathname.slice(prefix.length));
  if (request.method === "POST") {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      isolatedStorageObjects.set(key, { body: Buffer.concat(chunks), contentType: request.headers["content-type"] || "application/octet-stream" });
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ Key: key }));
    });
    return;
  }
  if (request.method === "DELETE") {
    isolatedStorageObjects.delete(key);
    response.writeHead(200, { "Content-Type": "application/json" }).end("{}");
    return;
  }
  const stored = isolatedStorageObjects.get(key);
  if (request.method === "GET" && stored) {
    response.writeHead(200, { "Content-Length": String(stored.body.length), "Content-Type": stored.contentType }).end(stored.body);
    return;
  }
  response.writeHead(404).end();
});

await new Promise((resolve, reject) => {
  isolatedStorageServer.once("error", reject);
  isolatedStorageServer.listen(0, "127.0.0.1", () => resolve(undefined));
});
const isolatedStorageAddress = isolatedStorageServer.address();
if (!isolatedStorageAddress || typeof isolatedStorageAddress === "string") throw new Error("Isolated object storage did not start on a TCP port.");
const isolatedStorageOrigin = `http://127.0.0.1:${isolatedStorageAddress.port}`;

function withSchema(value) {
  const url = new URL(value);
  url.searchParams.set("schema", schema);
  return url.toString();
}

function run(command, args, environment, stage) {
  return new Promise((resolvePromise, reject) => {
    const executable = process.platform === "win32" ? process.env.ComSpec : command;
    const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
    const child = spawn(executable, executableArgs, { env: environment, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const capture = (chunk) => {
      output = `${output}${chunk}`.slice(-20_000);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(JSON.stringify({ event: "isolated_release_stage_passed", stage }));
        resolvePromise(undefined);
        return;
      }
      process.stderr.write(output);
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

async function runWithRetries(command, args, environment, stage, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run(command, args, environment, stage);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.warn(JSON.stringify({ event: "isolated_release_stage_retry", stage, attempt }));
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError;
}

const environment = {
  ...process.env,
  NODE_ENV: "test",
  APP_ORIGIN: isolatedOrigin,
  API_PORT: isolatedApiPort,
  DATABASE_URL: withSchema(runtimeUrl),
  DATABASE_POOL_MAX: "2",
  DIRECT_URL: withSchema(directUrl),
  FACETRACK_ENCRYPTION_KEY: "isolated-release-test-facetrack-key",
  BOOTSTRAP_OWNER_NAME: "Release Test Owner",
  BOOTSTRAP_OWNER_EMAIL: "owner@release-test.invalid",
  BOOTSTRAP_OWNER_PASSWORD: "ReleaseTest2026!Owner",
  E2E_BASE_URL: isolatedOrigin,
  E2E_WORKERS: "1",
  MARKETING_DRY_RUN: "true",
  PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  STORAGE_BASE_URL: isolatedStorageOrigin,
  STORAGE_BUCKET: isolatedStorageBucket,
  STORAGE_SERVICE_KEY: "isolated-release-storage-key",
  VITE_API_PROXY: `http://127.0.0.1:${isolatedApiPort}`,
  VITE_PORT: isolatedWebPort,
};

try {
  await runWithRetries("pnpm", ["exec", "prisma", "migrate", "deploy"], environment, "migrations");
  await run("pnpm", ["exec", "prisma", "generate"], environment, "prisma_client");
  await run("pnpm", ["db:seed"], environment, "seed");
  await run("pnpm", ["bootstrap:owner"], environment, "owner_bootstrap");
  await run("pnpm", ["test:integration"], environment, "api_integration");
  await run("pnpm", ["test:e2e"], environment, "browser_e2e");
  console.log(JSON.stringify({ event: "isolated_release_test_passed", schema }));
} finally {
  try {
    const url = new URL(directUrl);
    url.searchParams.delete("schema");
    url.searchParams.delete("sslmode");
    const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      console.log(JSON.stringify({ event: "isolated_release_schema_removed", schema }));
    } finally {
      await client.end().catch(() => {});
    }
  } finally {
    isolatedStorageObjects.clear();
    await new Promise((resolve) => isolatedStorageServer.close(resolve));
  }
}
