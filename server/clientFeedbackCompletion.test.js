import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const server = readFileSync(join(root, "server", "index.js"), "utf8");
const app = readFileSync(join(root, "src", "App.jsx"), "utf8");

test("legacy client documents are durable records backed by secure uploads", () => {
  assert.match(schema, /model ClientDocument\s*\{/);
  assert.match(schema, /asset\s+UploadAsset\s+@relation/);
  assert.match(server, /app\.post\("\/api\/clients\/:id\/documents"/);
  assert.match(server, /category !== "client-document"/);
  assert.match(app, /Attach PDF\/DOCX/);
  assert.match(app, /loadClientDocuments\(client\.id\)/);
});

test("branch registration links resolve through the active private workspace form", () => {
  assert.match(server, /app\.get\("\/api\/public-registration\/open"/);
  assert.match(server, /publicRegistrationUrlForBranch/);
  assert.match(app, /\/api\/public-registration\/open\?branch=/);
  assert.doesNotMatch(app, /href=\{`\/register\?branch=/);
});

test("employee forms support the five requested workflows and administrator review", () => {
  for (const formType of ["Incident Report", "Leave Request", "Overtime Authorization", "Employee Disciplinary Action", "Performance Evaluation"]) {
    assert.match(server, new RegExp(formType));
  }
  assert.match(schema, /model StaffForm\s*\{/);
  assert.match(server, /Staff form submitted/);
  assert.match(server, /Only an authorized administrator can review staff forms/);
  assert.match(app, /Administrator details \/ action taken/);
  assert.match(app, /StaffFormsPanel/);
});

test("consent templates can retain and open the clinic's original form document", () => {
  assert.match(schema, /sourceDocumentAssetId\s+String\?/);
  assert.match(server, /"form-template"/);
  assert.match(app, /Original clinic form document/);
  assert.match(app, /Open original clinic form/);
});

test("promotion service selectors display names while persisting service IDs", () => {
  assert.match(app, /field\("serviceIds", "Included services", "multi-select", services\.map\(\(service\) => \(\{ value: service\.id, label: service\.name \}\)\)\)/);
});
