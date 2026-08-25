import { OAuth2Client } from "google-auth-library";

function clean(value) {
  return String(value ?? "").trim();
}

export function googleClientId(environment = process.env) {
  return clean(environment.GOOGLE_CLIENT_ID);
}

export function googleAuthenticationReady(environment = process.env) {
  return Boolean(googleClientId(environment));
}

export function googleIdentityProfile(payload) {
  const subject = clean(payload?.sub);
  const email = clean(payload?.email).toLowerCase();
  const name = clean(payload?.name).replace(/\s+/g, " ").slice(0, 100);
  const hostedDomain = clean(payload?.hd).toLowerCase();
  if (!subject || !email || payload?.email_verified !== true || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Google did not return a verified email identity.");
  }
  return {
    subject,
    email,
    name: name || email.split("@")[0],
    hostedDomain,
    emailVerified: true,
  };
}

export function googleIsAuthoritativeForEmail(profile) {
  return profile.email.endsWith("@gmail.com") || Boolean(profile.hostedDomain);
}

export async function verifyGoogleCredential(credential, {
  clientId = googleClientId(),
  verifier = new OAuth2Client(),
} = {}) {
  const idToken = clean(credential);
  if (!clientId) throw new Error("Google authentication is not configured.");
  if (!idToken) throw new Error("Google did not return an identity credential.");
  const ticket = await verifier.verifyIdToken({ idToken, audience: clientId });
  return googleIdentityProfile(ticket.getPayload());
}
