import test from "node:test";
import assert from "node:assert/strict";
import { productionConfigErrors } from "./productionConfig.js";

test("development configuration remains lightweight", () => {
  assert.deepEqual(productionConfigErrors({ NODE_ENV: "development" }), []);
});

test("production fails closed for insecure or incomplete configuration", () => {
  const errors = productionConfigErrors({
    NODE_ENV: "production",
    APP_ORIGIN: "http://app.example.com",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "short",
    API_ALLOW_TRUSTED_HEADERS: "true",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
  });
  assert.ok(errors.some((error) => error.includes("HTTPS")));
  assert.ok(errors.some((error) => error.includes("32 characters")));
  assert.ok(errors.some((error) => error.includes("forbidden")));
  assert.ok(errors.some((error) => error.includes("STORAGE_BASE_URL")));
});

test("production can start without optional SMTP delivery", () => {
  const errors = productionConfigErrors({
    NODE_ENV: "production",
    APP_ORIGIN: "https://clinic.example.ph",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "a".repeat(32),
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    STORAGE_BASE_URL: "https://storage.example.ph",
    STORAGE_BUCKET: "clinical-assets",
    STORAGE_SERVICE_KEY: "secret",
  });
  assert.deepEqual(errors, []);
});

test("production rejects partially configured SMTP delivery", () => {
  const errors = productionConfigErrors({
    NODE_ENV: "production",
    APP_ORIGIN: "https://clinic.example.ph",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "a".repeat(32),
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    STORAGE_BASE_URL: "https://storage.example.ph",
    STORAGE_BUCKET: "clinical-assets",
    STORAGE_SERVICE_KEY: "secret",
    SMTP_HOST: "smtp.mail.example",
  });
  assert.ok(errors.some((error) => error.includes("must be configured together")));
});

test("secure production configuration passes", () => {
  const errors = productionConfigErrors({
    NODE_ENV: "production",
    APP_ORIGIN: "https://clinic.example.ph",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "a".repeat(32),
    API_ALLOW_TRUSTED_HEADERS: "false",
    MARKETING_DRY_RUN: "false",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    STORAGE_BASE_URL: "https://storage.example.ph",
    STORAGE_BUCKET: "clinical-assets",
    STORAGE_SERVICE_KEY: "secret",
    SMTP_HOST: "smtp.mail.example",
    SMTP_FROM: "MACE ClinicOS <no-reply@clinic.example.ph>",
    SMTP_USER: "no-reply@clinic.example.ph",
    SMTP_PASS: "mailbox-secret",
  });
  assert.deepEqual(errors, []);
});

test("production rejects placeholder password-reset senders", () => {
  const errors = productionConfigErrors({
    NODE_ENV: "production",
    APP_ORIGIN: "https://clinic.example.ph",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "a".repeat(32),
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    STORAGE_BASE_URL: "https://storage.example.ph",
    STORAGE_BUCKET: "clinical-assets",
    STORAGE_SERVICE_KEY: "secret",
    SMTP_HOST: "smtp.mail.example",
    SMTP_FROM: "MACE ClinicOS <no-reply@example.com>",
    SMTP_USER: "no-reply@example.com",
    SMTP_PASS: "mailbox-secret",
  });
  assert.ok(errors.some((error) => error.includes("real clinic mailbox")));
});

test("production validates an optional Google Web Client ID", () => {
  const base = {
    NODE_ENV: "production",
    APP_ORIGIN: "https://clinic.example.ph",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "a".repeat(32),
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    STORAGE_BASE_URL: "https://storage.example.ph",
    STORAGE_BUCKET: "clinical-assets",
    STORAGE_SERVICE_KEY: "secret",
  };
  assert.ok(productionConfigErrors({ ...base, GOOGLE_CLIENT_ID: "not-a-client-id" }).some((error) => error.includes("Google Web Client ID")));
  assert.deepEqual(productionConfigErrors({ ...base, GOOGLE_CLIENT_ID: "123456789-example.apps.googleusercontent.com" }), []);
});

test("Cloudinary client-image storage requires one complete server-side credential set", () => {
  const base = {
    NODE_ENV: "production",
    APP_ORIGIN: "https://clinic.example.ph",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "a".repeat(32),
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    STORAGE_BASE_URL: "https://storage.example.ph",
    STORAGE_BUCKET: "clinical-assets",
    STORAGE_SERVICE_KEY: "secret",
  };
  const incomplete = productionConfigErrors({
    ...base,
    CLIENT_IMAGE_STORAGE_PROVIDER: "cloudinary",
    CLOUDINARY_CLOUD_NAME: "clinic-cloud",
  });
  assert.ok(incomplete.some((error) => error.includes("must be configured together")));
  assert.ok(incomplete.some((error) => error.includes("CLOUDINARY_API_KEY is required")));
  assert.deepEqual(productionConfigErrors({
    ...base,
    CLIENT_IMAGE_STORAGE_PROVIDER: "cloudinary",
    CLOUDINARY_CLOUD_NAME: "clinic-cloud",
    CLOUDINARY_API_KEY: "123456",
    CLOUDINARY_API_SECRET: "server-secret",
  }), []);
});
