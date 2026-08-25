import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const googleButtonSource = readFileSync(new URL("../src/components/GoogleIdentityButton.jsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260826043000_google_identity_and_registration_email/migration.sql", import.meta.url), "utf8");

test("password and Google registrations both attempt a confirmation email", () => {
  const passwordRegistration = serverSource.slice(serverSource.indexOf('app.post("/api/auth/register"'), serverSource.indexOf('app.post("/api/auth/google"'));
  const googleRegistration = serverSource.slice(serverSource.indexOf('app.post("/api/auth/google"'), serverSource.indexOf('app.post("/api/auth/demo-register"'));
  assert.match(passwordRegistration, /deliverRegistrationConfirmation\(account, "email and password"\)/);
  assert.match(googleRegistration, /isNewAccount \? await deliverRegistrationConfirmation\(account, "Google"\) : null/);
  assert.match(serverSource, /registrationEmailSentAt: new Date\(\)/);
});

test("Google authentication verifies the ID token and stores its stable provider subject", () => {
  const googleRoute = serverSource.slice(serverSource.indexOf('app.post("/api/auth/google"'), serverSource.indexOf('app.post("/api/auth/demo-register"'));
  assert.match(googleRoute, /verifyGoogleCredential/);
  assert.match(googleRoute, /providerSubject: profile\.subject/);
  assert.match(googleRoute, /assertGoogleRequestOrigin\(request\)/);
  assert.match(googleRoute, /GOOGLE_ACCOUNT_LINK_REQUIRED/);
  assert.doesNotMatch(googleRoute, /decode.*credential|JSON\.parse.*credential/i);
});

test("the account identity migration is additive and provider identities are unique", () => {
  assert.match(schema, /model AccountIdentity/);
  assert.match(schema, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(schema, /@@unique\(\[accountId, provider\]\)/);
  assert.match(migration, /CREATE TABLE "AccountIdentity"/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|DROP COLUMN/i);
});

test("login and registration render the official Google Identity Services button", () => {
  assert.match(appSource, /<GoogleIdentityButton mode="signin"/);
  assert.match(appSource, /<GoogleIdentityButton mode="signup"/);
  assert.match(googleButtonSource, /https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(googleButtonSource, /google\.accounts\.id\.renderButton/);
  assert.match(serverSource, /https:\/\/accounts\.google\.com\/gsi\/client/);
});
