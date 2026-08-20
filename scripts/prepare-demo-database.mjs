import "dotenv/config";
import { spawn } from "node:child_process";

const runtimeUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL || runtimeUrl;
const schema = String(process.env.DEMO_SCHEMA || "").trim();
const ownerEmail = String(process.env.DEMO_OWNER_EMAIL || "demo@macesoft.app").trim().toLowerCase();
const ownerName = String(process.env.DEMO_OWNER_NAME || "MACE Demo Owner").trim();
const ownerPassword = String(process.env.DEMO_OWNER_PASSWORD || "");

if (!runtimeUrl || !directUrl) throw new Error("DATABASE_URL and DIRECT_URL are required.");
if (!/^macesoft_demo_[a-z0-9_]+$/i.test(schema)) throw new Error("DEMO_SCHEMA must use the macesoft_demo_* namespace.");
if (!ownerEmail || !ownerName || !ownerPassword) throw new Error("Demo owner identity and password are required.");

function withSchema(value) {
  const url = new URL(value);
  url.searchParams.set("schema", schema);
  return url.toString();
}

const environment = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: withSchema(runtimeUrl),
  DIRECT_URL: withSchema(directUrl),
  DEMO_SEED_CONFIRM: schema,
  BOOTSTRAP_OWNER_EMAIL: ownerEmail,
  BOOTSTRAP_OWNER_NAME: ownerName,
  BOOTSTRAP_OWNER_PASSWORD: ownerPassword,
};

function run(command, args, stage) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" ? process.env.ComSpec : command;
    const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
    const child = spawn(executable, executableArgs, { env: environment, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(JSON.stringify({ event: "demo_prepare_stage_completed", stage }));
        resolve(undefined);
      } else {
        reject(new Error(`${stage} exited with code ${code}.`));
      }
    });
  });
}

await run("pnpm", ["exec", "prisma", "migrate", "deploy"], "migrations");
await run("pnpm", ["db:seed"], "base_seed");
await run("pnpm", ["bootstrap:owner"], "owner_bootstrap");
await run("pnpm", ["db:seed:demo"], "demo_seed");
console.log(JSON.stringify({ event: "demo_database_prepared", schema, ownerEmail }));
