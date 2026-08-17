import assert from "node:assert/strict";
import test from "node:test";

import { audienceCsvText, parseAudienceCsv } from "../src/marketing/audienceCsv.js";

test("audience CSV import accepts common headers and quoted values", () => {
  const result = parseAudienceCsv('Full Name,Email Address,Clinic\n"Doe, Jane",JANE@example.com,Mace Davao\nBad,bad-address,Mace Davao');

  assert.deepEqual(result, {
    contacts: [{ name: "Doe, Jane", email: "jane@example.com", branch: "Mace Davao" }],
    invalid: 1,
  });
});

test("audience CSV export protects spreadsheet formula cells", () => {
  const csv = audienceCsvText([{ name: "=HYPERLINK(\"bad\")", email: "jane@example.com", mobile: "09171234567", branch: "Mace Davao", source: "Manual", audienceMember: true, audience: "VIP" }]);

  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"jane@example.com"/);
  assert.match(csv, /"09171234567"/);
});

test("audience CSV import requires an email column", () => {
  assert.throws(() => parseAudienceCsv("Name,Phone\nJane,09170000000"), /Email or Email Address column/i);
});
