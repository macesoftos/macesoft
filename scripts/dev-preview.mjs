// Dev launcher for browser previews: some preview hosts inject PORT for the
// web server, which would otherwise re-point the Express API away from the
// port the Vite proxy expects. Pin the API to API_PORT (default 3001) and let
// Vite own the injected PORT.
import { spawn } from "node:child_process";

const apiPort = process.env.API_PORT || "3001";
const children = [
  spawn(process.execPath, ["server/index.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: apiPort,
      // Local dev only: this workstation's TLS chain to Supabase is
      // intercepted, so allow the connection unless .env overrides it.
      DATABASE_SSL_REJECT_UNAUTHORIZED: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || "false",
    },
  }),
  spawn("npx", ["vite", "--host", "127.0.0.1"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  }),
];

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

for (const child of children) {
  child.on("exit", () => {
    shutdown();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
