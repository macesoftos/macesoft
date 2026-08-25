import assert from "node:assert/strict";
import test from "node:test";

import { isDemoSignupHostname } from "../src/config/demoAccess.js";

test("demo signup is available on both custom-domain forms and the staging host", () => {
  assert.equal(isDemoSignupHostname("zenshotech.com"), true);
  assert.equal(isDemoSignupHostname("WWW.ZENSHOTECH.COM"), true);
  assert.equal(isDemoSignupHostname("lightcoral-crab-954053.hostingersite.com"), true);
  assert.equal(isDemoSignupHostname("untrusted.example.com"), false);
});
