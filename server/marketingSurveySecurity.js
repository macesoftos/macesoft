import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function surveyError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function clean(value) {
  return String(value ?? "").trim();
}

function signatureFor(encodedPayload, secret) {
  return createHmac("sha256", secret).update(`macesoft-survey-v1:${encodedPayload}`).digest("base64url");
}

export function surveyRecipientId(recipient) {
  return createHash("sha256").update(clean(recipient).toLowerCase()).digest("base64url");
}

export function createMarketingSurveyToken({ campaignId, recipient, secret, expiresAt = new Date(Date.now() + 30 * 86_400_000) }) {
  if (!clean(campaignId) || !clean(recipient) || !clean(secret)) throw surveyError("Survey token configuration is incomplete.", 503);
  const payload = {
    v: 1,
    c: clean(campaignId),
    r: surveyRecipientId(recipient),
    e: Math.floor(new Date(expiresAt).getTime() / 1000),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

/**
 * @param {string} token
 * @param {{ campaignId?: string, secret?: string, now?: Date }} [options]
 */
export function verifyMarketingSurveyToken(token, { campaignId, secret, now = new Date() } = {}) {
  const [encodedPayload, suppliedSignature] = clean(token).split(".");
  if (!encodedPayload || !suppliedSignature || !clean(secret)) throw surveyError("This survey link is invalid.", 403);
  const expectedSignature = signatureFor(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw surveyError("This survey link is invalid.", 403);

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw surveyError("This survey link is invalid.", 403);
  }
  if (payload?.v !== 1 || payload.c !== clean(campaignId) || !clean(payload.r)) throw surveyError("This survey link is invalid.", 403);
  if (!Number.isFinite(payload.e) || payload.e <= Math.floor(now.getTime() / 1000)) throw surveyError("This survey link has expired.", 410);
  return { campaignId: payload.c, recipientId: payload.r, expiresAt: new Date(payload.e * 1000) };
}

export function marketingSurveyResponseId({ campaignId, blockId, recipientId }) {
  return `survey_${createHash("sha256").update(`${clean(campaignId)}\0${clean(blockId)}\0${clean(recipientId)}`).digest("hex")}`;
}
