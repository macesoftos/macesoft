import assert from "node:assert/strict";
import test from "node:test";
import {
  googleAuthenticationReady,
  googleClientId,
  googleIdentityProfile,
  googleIsAuthoritativeForEmail,
  verifyGoogleCredential,
} from "./googleAuthentication.js";

test("Google authentication is enabled only with a configured web client ID", () => {
  assert.equal(googleClientId({ GOOGLE_CLIENT_ID: " client.apps.googleusercontent.com " }), "client.apps.googleusercontent.com");
  assert.equal(googleAuthenticationReady({ GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com" }), true);
  assert.equal(googleAuthenticationReady({}), false);
});

test("Google identities require a stable subject and verified email", () => {
  const gmail = googleIdentityProfile({ sub: "google-123", email: " Owner@Gmail.com ", email_verified: true, name: "  Jamie   Owner " });
  assert.deepEqual(gmail, {
    subject: "google-123",
    email: "owner@gmail.com",
    name: "Jamie Owner",
    hostedDomain: "",
    emailVerified: true,
  });
  assert.equal(googleIsAuthoritativeForEmail(gmail), true);
  assert.equal(googleIsAuthoritativeForEmail(googleIdentityProfile({ sub: "google-456", email: "owner@clinic.ph", email_verified: true, hd: "clinic.ph" })), true);
  assert.equal(googleIsAuthoritativeForEmail(googleIdentityProfile({ sub: "google-789", email: "owner@example.net", email_verified: true })), false);
  assert.throws(() => googleIdentityProfile({ sub: "google-123", email: "owner@gmail.com", email_verified: false }), /verified email identity/);
});

test("Google credentials are verified against the configured audience", async () => {
  const calls = [];
  const verifier = {
    async verifyIdToken(options) {
      calls.push(options);
      return { getPayload: () => ({ sub: "google-123", email: "owner@gmail.com", email_verified: true, name: "Jamie" }) };
    },
  };
  // @ts-expect-error The focused fake deliberately implements only the verifier method used by this helper.
  const profile = await verifyGoogleCredential("signed-id-token", { clientId: "web-client-id", verifier });
  assert.equal(profile.subject, "google-123");
  assert.deepEqual(calls, [{ idToken: "signed-id-token", audience: "web-client-id" }]);
});
