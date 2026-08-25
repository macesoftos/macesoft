import assert from "node:assert/strict";
import test from "node:test";
import { registrationConfirmationEmail } from "./registrationConfirmationEmail.js";

test("registration confirmation contains workspace and sign-in details without a password", () => {
  const email = registrationConfirmationEmail({
    account: { name: "Jamie <Owner>", email: "OWNER@example.com" },
    organization: { name: "Glow & Go Clinic" },
    appOrigin: "https://zenshotech.com,https://www.zenshotech.com",
    authenticationMethod: "Google",
  });
  assert.equal(email.to, "owner@example.com");
  assert.match(email.subject, /Welcome to ZenshoTech/);
  assert.match(email.text, /Glow & Go Clinic/);
  assert.match(email.text, /Sign-in method: Google/);
  assert.match(email.text, /https:\/\/zenshotech\.com/);
  assert.doesNotMatch(email.text, /password:/i);
  assert.match(email.html, /Jamie &lt;Owner&gt;/);
  assert.match(email.html, /Glow &amp; Go Clinic/);
});
