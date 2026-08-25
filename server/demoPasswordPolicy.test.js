import assert from "node:assert/strict";
import test from "node:test";

import { demoPasswordMeetsMinimum, demoPasswordMinimumLength } from "./demoPasswordPolicy.js";

test("demo passwords use a simple eight-character minimum", () => {
  assert.equal(demoPasswordMinimumLength, 8);
  assert.equal(demoPasswordMeetsMinimum("demo1234"), true);
  assert.equal(demoPasswordMeetsMinimum("password"), true);
  assert.equal(demoPasswordMeetsMinimum("Demo123!"), true);
  assert.equal(demoPasswordMeetsMinimum("short7"), false);
});
