# Marketing workspace

## Existing implementation inventory

- The user-facing application is a React/Vite single-page app. `src/App.jsx` owns the global workspace shell, authentication bootstrap and the existing hash-based module router.
- Marketing access continues to use the internal `sms` module key. That key is referenced by role permissions, global actions, server access control and the module registry, so it is intentionally not renamed.
- Existing campaign and text-message-template data continue to use the `campaigns` and `smsTemplates` resources. Their Prisma delegates remain `marketingCampaign` and `smsTemplate`.
- Existing delivery continues through `POST /api/marketing/send`. The server retains its current SMTP and Twilio boundaries, dry-run protection, recipient selection, delivery limits, audit logging and credit handling.
- The former Marketing UI was a single campaign table and text-message-template list rendered directly in `src/App.jsx`.

## User-facing routing

The canonical workspace routes are:

- `#/marketing`
- `#/marketing/campaigns`
- `#/marketing/templates`
- `#/marketing/audiences`
- `#/marketing/automations`
- `#/marketing/reports`
- `#/marketing/settings`

The campaign builder uses `/marketing/campaigns/new`. Legacy `#/marketing/...` and `#/sms` entry points are replaced with clean `/marketing/...` paths through browser history, so existing bookmarks keep working.

## Current delivery boundary

The new workspace does not claim that unsupported provider actions succeeded:

- Existing saved campaigns and the existing send action remain backed by the current API.
- The builder persists in-progress content in browser storage and saves both versioned design JSON and sanitized email HTML through the current `campaigns` resource.
- Visual designs render to responsive, table-based email HTML. Staff can also paste or import a complete `.html`/`.htm` document, preview it in a sandbox, clean unsupported code and export the final document.
- Imported HTML is sanitized in the browser for immediate feedback and sanitized again by the API before storage or delivery. Scripts, forms, embedded frames, event handlers, unsafe URL schemes and executable CSS are removed.
- “Send test” explains that a dedicated test-delivery endpoint is required; it does not call the bulk-send endpoint.
- Automations open as reviewable campaign drafts and are not presented as active jobs.
- Email opens, clicks, bounces, complaints and unsubscribe metrics remain blank until provider webhooks are connected.

## Backend work required for full email operations

The frontend is prepared for these additions, but they should be implemented server-side before enabling production email scheduling:

1. Add channel-specific consent and suppression fields to the client/contact model, including `emailMarketingConsent`, `smsMarketingConsent`, consent source/timestamp, email unsubscribe state, SMS opt-out state, bounce state and provider suppression state. Migrate existing general opt-ins deliberately rather than silently assuming both channel permissions.
2. Move reusable saved templates from browser storage into a dedicated Marketing template model so teams can share and version them across devices.
3. Persist saved audience definitions as validated filter JSON and expose a server-side recipient-estimate endpoint that applies branch access, consent, suppression and valid-contact checks.
4. Add explicit test-send, approval and scheduling endpoints. Recommended boundaries are `POST /api/marketing/test`, `POST /api/marketing/estimate`, `POST /api/marketing/campaigns/:id/approve` and `POST /api/marketing/campaigns/:id/schedule`.
5. Add authenticated provider webhooks for delivery, open, click, bounce, complaint, unsubscribe and SMS opt-out events. Store provider event identifiers idempotently.
6. Keep transactional appointment reminders in their current notification path. Marketing recipient selection must never reuse transactional consent.

Provider credentials, signing secrets and sender-domain configuration belong only in server environment variables. No provider credential should be exposed to the browser bundle or saved in campaign content.
