import { spawn } from "node:child_process";

const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;
const ownerHeaders = {
  "Content-Type": "application/json",
  "X-Mace-User-Id": "u-owner",
  "X-Mace-User-Name": "Dr. Mace",
  "X-Mace-Role": "Owner",
  "X-Mace-Branch": "All branches",
};

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { response, payload };
}

async function waitForApi() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    try {
      const { response } = await request("/api/health");
      if (response.ok) return;
    } catch {
      // Keep waiting while the server starts.
    }
    await delay(250);
  }
  throw new Error("API did not start within 10 seconds.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function jsonRequest(path, body, options = {}) {
  return request(path, {
    method: options.method ?? "POST",
    headers: ownerHeaders,
    body: JSON.stringify(body),
  });
}

const server = spawn(process.execPath, ["server/index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, API_PORT: String(port), LEADS_API_KEY: "smoke-leads-key", API_ALLOW_TRUSTED_HEADERS: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForApi();

  const health = await request("/api/health");
  assert(health.response.ok && health.payload.ok, "health endpoint failed");

  const bootstrap = await request("/api/bootstrap");
  assert(bootstrap.response.ok, "bootstrap endpoint failed");
  assert(Array.isArray(bootstrap.payload.clients), "bootstrap clients missing");
  assert(Array.isArray(bootstrap.payload.appointments), "bootstrap appointments missing");
  assert(Array.isArray(bootstrap.payload.transactions), "bootstrap transactions missing");

  const unauthorized = await request("/api/resources/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Unauthorized Smoke", branch: "Mace BGC" }),
  });
  assert(unauthorized.response.status === 401, "unauthorized client create was not blocked");

  const suffix = Date.now().toString(36);
  const clientId = `cl-smoke-${suffix}`;
  const appointmentId = `ap-smoke-${suffix}`;

  const createdClient = await jsonRequest("/api/resources/clients", {
    id: clientId,
    fullName: "Automated Smoke Client",
    mobile: `0999${suffix.slice(-6)}`,
    email: "automated-smoke@example.test",
    branch: "Mace BGC",
    source: "Automated smoke test",
    marketingOptIn: true,
  });
  assert(createdClient.response.status === 201, "client create failed");

  const updatedClient = await jsonRequest(`/api/resources/clients/${clientId}`, {
    id: clientId,
    fullName: "Automated Smoke Client Updated",
    mobile: createdClient.payload.record.mobile,
    email: "automated-smoke@example.test",
    branch: "Mace BGC",
    source: "Automated smoke test",
    marketingOptIn: false,
  }, { method: "PUT" });
  assert(updatedClient.response.ok, "client update failed");
  assert(updatedClient.payload.record.fullName.includes("Updated"), "client update did not persist");

  const appointment = await jsonRequest("/api/resources/appointments", {
    id: appointmentId,
    date: "2026-09-14",
    time: "10:30",
    clientId,
    serviceId: "svc-consult",
    branch: "Mace BGC",
    room: "Room 1",
    staff: "Dr. Mace",
    status: "Pending",
    deposit: 0,
  });
  assert(appointment.response.status === 201, "appointment create failed");

  const conflict = await jsonRequest("/api/resources/appointments", {
    id: `ap-conflict-${suffix}`,
    date: "2026-09-14",
    time: "10:30",
    clientId,
    serviceId: "svc-consult",
    branch: "Mace BGC",
    room: "Room 1",
    staff: "Dr. Mace",
    status: "Pending",
    deposit: 0,
  });
  assert(conflict.response.status === 409, "appointment conflict was not detected");

  const leadMobile = `0998${suffix.slice(-6).padStart(6, "0")}`;
  const leadPayload = {
    event_id: `lead-event-${suffix}`,
    full_name: `Webhook Smoke ${suffix}`,
    phone_number: leadMobile,
    email_address: `lead-${suffix}@example.test`,
    preferred_service: "Aesthetic Consultation",
    branch: "Mace BGC",
    campaign: "Smoke Test Campaign",
    consent_source: "Smoke form",
    privacy_consent: true,
    permission_to_contact: true,
  };

  const invalidWebhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(leadPayload),
  });
  assert(invalidWebhook.response.status === 401, "invalid webhook auth was not rejected");

  const webhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mace-Leads-Token": "smoke-leads-key",
      "Idempotency-Key": `lead-event-${suffix}`,
    },
    body: JSON.stringify(leadPayload),
  });
  assert(webhook.response.status === 201, "valid lead webhook did not create a lead");
  assert(webhook.payload.lead?.id, "webhook response did not include a lead");
  const webhookLeadId = webhook.payload.lead.id;

  const retryWebhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mace-Leads-Token": "smoke-leads-key",
      "Idempotency-Key": `lead-event-${suffix}`,
    },
    body: JSON.stringify(leadPayload),
  });
  assert(retryWebhook.response.ok && retryWebhook.payload.duplicateEvent === true, "webhook retry was not idempotent");

  const duplicateWebhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mace-Leads-Token": "smoke-leads-key",
      "Idempotency-Key": `lead-event-duplicate-${suffix}`,
    },
    body: JSON.stringify({ ...leadPayload, event_id: `lead-event-duplicate-${suffix}`, full_name: `Duplicate Smoke ${suffix}` }),
  });
  assert(duplicateWebhook.response.ok && duplicateWebhook.payload.status === "Duplicate", "duplicate lead phone match was not detected");

  const qualifiedLead = await jsonRequest(`/api/leads/${webhookLeadId}/stage`, {
    status: "Qualified",
  });
  assert(qualifiedLead.response.ok && qualifiedLead.payload.lead.status === "Qualified", "lead qualification failed");

  const invalidStage = await jsonRequest(`/api/leads/${webhookLeadId}/stage`, {
    status: "Appointment Booked",
  });
  assert(invalidStage.response.status === 400, "appointment-booked transition without appointment was not blocked");

  const followUp = await jsonRequest(`/api/leads/${webhookLeadId}/follow-ups`, {
    dueAt: "2026-09-15T09:00",
    channel: "Phone",
    purpose: "Smoke follow-up",
  });
  assert(followUp.response.status === 201, "lead follow-up create failed");
  assert(followUp.payload.lead.followUps.length >= 1, "lead follow-up did not persist");

  const convertedLead = await jsonRequest(`/api/leads/${webhookLeadId}/convert`, {
    notes: "Smoke conversion",
  });
  assert(convertedLead.response.status === 201, "lead conversion failed");
  assert(convertedLead.payload.lead.status === "Converted", "lead did not move to Converted");

  const duplicateConversion = await jsonRequest(`/api/leads/${webhookLeadId}/convert`, {
    notes: "Expected duplicate conversion block",
  });
  assert(duplicateConversion.response.status === 409, "duplicate conversion was not blocked");

  const impossibleCheckout = await jsonRequest("/api/pos/checkout", {
    draft: {
      clientName: "Automated Smoke Client Updated",
      branch: "Mace BGC",
      staff: "Dr. Mace",
      invoicePrefix: "MACE",
      cart: [
        {
          key: "product-inv-cleanser-kit",
          inventoryId: "inv-cleanser-kit",
          type: "Product",
          name: "Cleanser Travel Kit",
          qty: 999999,
        },
      ],
    },
    payment: {
      payments: [{ method: "Cash", amount: 1 }],
      notes: "Expected to fail stock validation",
    },
  });
  assert(impossibleCheckout.response.status === 409, "POS insufficient-stock validation failed");

  await request(`/api/resources/appointments/${appointmentId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/clients/${clientId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/leads/${webhookLeadId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  if (convertedLead.payload.client?.id) {
    await request(`/api/resources/clients/${convertedLead.payload.client.id}`, {
      method: "DELETE",
      headers: ownerHeaders,
    });
  }

  console.log("API smoke test passed.");
} catch (error) {
  console.error(serverOutput);
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
