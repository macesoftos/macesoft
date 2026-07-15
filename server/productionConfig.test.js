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
    ENABLE_DEMO_ACCOUNTS: "true",
    API_ALLOW_TRUSTED_HEADERS: "true",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
  });
  assert.ok(errors.some((error) => error.includes("HTTPS")));
  assert.ok(errors.some((error) => error.includes("32 characters")));
  assert.ok(errors.some((error) => error.includes("forbidden")));
  assert.ok(errors.some((error) => error.includes("STORAGE_BASE_URL")));
});

test("secure production configuration passes", () => {
  const errors = productionConfigErrors({
    NODE_ENV: "production",
    APP_ORIGIN: "https://clinic.example.ph",
    DATABASE_URL: "postgresql://runtime",
    DIRECT_URL: "postgresql://direct",
    FACETRACK_ENCRYPTION_KEY: "a".repeat(32),
    ENABLE_DEMO_ACCOUNTS: "false",
    API_ALLOW_TRUSTED_HEADERS: "false",
    MARKETING_DRY_RUN: "false",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    STORAGE_BASE_URL: "https://storage.example.ph",
    STORAGE_BUCKET: "clinical-assets",
    STORAGE_SERVICE_KEY: "secret",
  });
  assert.deepEqual(errors, []);
});
