import "dotenv/config";
import { spawn } from "node:child_process";
import pg from "pg";

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
if (!directUrl || !runtimeUrl) throw new Error("DATABASE_URL and DIRECT_URL are required for isolated release testing.");
const schema = `codex_release_${Date.now()}_${process.pid}`;

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

const environment = {
  ...process.env,
  NODE_ENV: "test",
  APP_ORIGIN: "http://127.0.0.1:5173",
  DATABASE_URL: withSchema(runtimeUrl),
  DIRECT_URL: withSchema(directUrl),
  FACETRACK_ENCRYPTION_KEY: "isolated-release-test-facetrack-key",
  SEED_STAFF_PASSWORD: "Mace2026!",
  ENABLE_DEMO_ACCOUNTS: "false",
  MARKETING_DRY_RUN: "true",
};

try {
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], environment, "migrations");
  await run("pnpm", ["db:seed"], environment, "seed");
  await run("pnpm", ["test:integration"], environment, "api_integration");
  await run("pnpm", ["test:e2e"], environment, "browser_e2e");
  console.log(JSON.stringify({ event: "isolated_release_test_passed", schema }));
} finally {
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
}
