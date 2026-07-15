function enabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function disabled(value) {
  return ["0", "false", "no", "off"].includes(String(value || "").trim().toLowerCase());
}

function present(environment, names, errors) {
  for (const name of names) {
    if (!String(environment[name] || "").trim()) errors.push(`${name} is required in production.`);
  }
}

export function productionConfigErrors(environment = process.env) {
  if (environment.NODE_ENV !== "production") return [];
  const errors = [];
  present(environment, ["APP_ORIGIN", "DATABASE_URL", "DIRECT_URL", "FACETRACK_ENCRYPTION_KEY"], errors);

  const origins = String(environment.APP_ORIGIN || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origins.some((origin) => !origin.startsWith("https://") || origin.includes("example.com"))) {
    errors.push("APP_ORIGIN must contain only deployed HTTPS origins.");
  }
  if (String(environment.FACETRACK_ENCRYPTION_KEY || "").length < 32) {
    errors.push("FACETRACK_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  if (enabled(environment.ENABLE_DEMO_ACCOUNTS)) errors.push("ENABLE_DEMO_ACCOUNTS must be false in production.");
  if (enabled(environment.API_ALLOW_TRUSTED_HEADERS)) errors.push("API_ALLOW_TRUSTED_HEADERS is forbidden in production.");
  if (enabled(environment.MARKETING_DRY_RUN)) errors.push("MARKETING_DRY_RUN must be false in production.");
  if (disabled(environment.DATABASE_SSL_REJECT_UNAUTHORIZED)) {
    errors.push("DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production.");
  }

  if (!disabled(environment.REQUIRE_OBJECT_STORAGE)) {
    present(environment, ["STORAGE_BASE_URL", "STORAGE_BUCKET", "STORAGE_SERVICE_KEY"], errors);
  }
  if (enabled(environment.REQUIRE_MARKETING_PROVIDERS)) {
    present(environment, ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "SMTP_HOST", "SMTP_FROM"], errors);
    if (!environment.TWILIO_FROM_NUMBER && !environment.TWILIO_MESSAGING_SERVICE_SID) {
      errors.push("TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID is required in production.");
    }
  }
  return errors;
}

export function assertProductionEnvironment(environment = process.env) {
  const errors = productionConfigErrors(environment);
  if (errors.length) throw new Error(`Production configuration is invalid:\n- ${errors.join("\n- ")}`);
}
