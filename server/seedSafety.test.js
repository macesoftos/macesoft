import test from "node:test";
import assert from "node:assert/strict";
import { initialStaff } from "../src/data.js";

test("development seed never preloads staff profiles", () => {
  assert.deepEqual(initialStaff, []);
});
