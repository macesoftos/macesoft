import test from "node:test";
import assert from "node:assert/strict";
import {
  apiAuthenticationRequiredEvent,
  setApiSessionContext,
  updateLeadStage,
} from "../src/lib/api.js";

test("an authenticated client broadcasts a session-expired event after a 401", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  /** @type {Event | null} */
  let dispatchedEvent = null;

  context.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    setApiSessionContext(null);
  });

  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: "Authentication is required." }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
  const windowTarget = new EventTarget();
  windowTarget.addEventListener(apiAuthenticationRequiredEvent, (event) => {
    dispatchedEvent = event;
  });
  globalThis.window = /** @type {Window & typeof globalThis} */ (windowTarget);
  setApiSessionContext({ id: "account-1" });

  await assert.rejects(
    updateLeadStage("lead-1", { status: "Qualified" }),
    /Authentication is required/,
  );
  assert.equal(dispatchedEvent?.type, apiAuthenticationRequiredEvent);
});
