import assert from "node:assert/strict";
import test from "node:test";
import { providerRegistrationEmail } from "./providerRegistrationEmail.js";

test("provider registration alert identifies the registrant and links to the secured workspace", () => {
  const email = providerRegistrationEmail({
    recipient: "OWNER@zenshotech.com",
    account: { name: "Jamie <Owner>", email: "jamie@example.com", organizationId: "org-123" },
    organization: { id: "org-123", name: "Glow & Go Clinic" },
    authenticationMethod: "Google",
    registeredAt: new Date("2026-08-27T02:00:00.000Z"),
    appOrigin: "https://zenshotech.com,https://www.zenshotech.com",
  });

  assert.equal(email.to, "owner@zenshotech.com");
  assert.equal(email.replyTo, "jamie@example.com");
  assert.match(email.subject, /New registration - Glow & Go Clinic/);
  assert.match(email.text, /Sign-in method: Google/);
  assert.match(email.text, /https:\/\/zenshotech\.com\/provider/);
  assert.match(email.html, /Jamie &lt;Owner&gt;/);
  assert.match(email.html, /Glow &amp; Go Clinic/);
});

test("provider registration alert labels isolated demo accounts", () => {
  const email = providerRegistrationEmail({
    recipient: "owner@zenshotech.com",
    account: { name: "Demo User", email: "demo@example.com" },
    organization: { name: "Demo Clinic" },
    workspaceType: "demo",
  });

  assert.match(email.subject, /New demo registration/);
  assert.match(email.text, /Type: Demo workspace/);
});
