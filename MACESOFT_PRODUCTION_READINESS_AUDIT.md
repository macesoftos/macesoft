# MaceSoft Production Readiness Audit

Generated: 2026-07-11

## Architecture Inventory

- Frontend: Vite, React 19, local hash-based module routing.
- Backend: Express 5 API on `127.0.0.1:3001`.
- Database: SQLite at `prisma/dev.db`.
- ORM: Prisma 7 with `@prisma/adapter-better-sqlite3`.
- Auth: local browser session using seeded role identities from `src/data.js`.
- API architecture: REST endpoints under `/api`, plus resource CRUD endpoints under `/api/resources/:resource`.
- State management: React component state persisted to `localStorage`; production data is now bootstrapped from `/api/bootstrap` and writes call the API.
- Validation: client required fields in reusable modal forms; server-side validation added for resource payloads, appointment conflicts, POS stock, monetary values, and branch/role checks.
- Storage/uploads: image uploads are stored as browser data URLs; no production object storage is configured.
- Third-party services: Twilio SMS and SMTP email are supported by environment variables; unavailable credentials block live delivery.

## Module Wiring Matrix

| Module | Page/Route | UI Present | API Wired | Database Wired | Validation | Permissions | Loading State | Error State | Empty State | Tested | Status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Overview/Dashboard | `#/overview` | Yes | Yes | Yes | Partial | Partial | Yes | Partial | Yes | Browser smoke | Partially Functional |
| Authentication | Login screen | Yes | No | No | No | No | N/A | Partial | N/A | Manual read | Placeholder |
| Role/Permissions | Settings/sidebar/API headers | Yes | Yes | Partial | Partial | Partial | N/A | Yes | N/A | API smoke | Partially Functional |
| Global Search | Topbar/table search | Yes | No | No | Partial | UI only | N/A | N/A | Yes | Manual read | Partially Functional |
| Notifications | Bell/toasts | Yes | No | No | No | UI only | N/A | Partial | Partial | Manual read | Placeholder |
| Clients | `#/clients` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | API smoke | Partially Functional |
| Appointments | `#/appointments` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | API smoke | Partially Functional |
| Card View | `#/card-view` | Yes | Via appointments | Yes | Yes | Partial | Yes | Yes | Yes | API smoke dependency | Partially Functional |
| Room View | `#/room-view` | Yes | Via appointments | Yes | Partial | Partial | Yes | Yes | Yes | Manual read | Partially Functional |
| Staff Schedule | `#/staff-view` | Yes | Via appointments/staff | Yes | Partial | Partial | Yes | Yes | Yes | Manual read | Partially Functional |
| Treatments | `#/treatments` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | Build/API path | Partially Functional |
| Services | `#/services` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | Build/API path | Partially Functional |
| Online Booking | `#/booking` | Yes | Yes | Yes | Yes | Public endpoint | Yes | Yes | Yes | API smoke | Partially Functional |
| POS | `#/pos` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | API smoke | Partially Functional |
| Packages | `#/packages` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | API smoke | Partially Functional |
| Inventory | `#/inventory` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | API smoke | Partially Functional |
| Leads | `#/leads` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | API smoke | Partially Functional |
| Marketing | `#/sms` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | Build/API path | Blocked by Missing Configuration |
| Staff Management | `#/staff` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | Build/API path | Partially Functional |
| Branches | `#/branches` | Yes | Read via bootstrap | Yes | No | Partial | Yes | Partial | Yes | Manual read | Partially Functional |
| Expenses | `#/expenses` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | Build/API path | Partially Functional |
| Reports | `#/reports` | Yes | Via bootstrapped records | Yes | Partial | Partial | Yes | Partial | Yes | Browser smoke | Partially Functional |
| Settings | `#/settings` | Yes | Yes | Yes | Yes | Partial | Yes | Yes | Yes | Build/API path | Partially Functional |
| Support | `#/support` | Yes | No | No | N/A | UI only | N/A | N/A | N/A | Manual read | Placeholder |

## Major Issues Fixed

| Module | Problem | Root Cause | Fix Implemented | Test Performed |
|---|---|---|---|---|
| All data modules | Most modules saved only to browser state/localStorage. | API exposed only clients plus marketing send. | Added `/api/bootstrap` and resource CRUD endpoints for clients, appointments, services, inventory, treatments, packages, leads, staff, expenses, discounts, templates, campaigns, audit logs. | `pnpm test`, API smoke, browser boot check |
| POS | Checkout trusted browser-created invoice/totals and local-only inventory deduction. | Checkout ran entirely in `App.jsx`. | Added `/api/pos/checkout` with server recalculation, payments, sale/item persistence, inventory deduction, movement creation, and audit log in one transaction. | API smoke POS insufficient-stock check and manual checkout smoke |
| Appointments | Schedule conflicts were not enforced on the server. | Appointment save only wrote local state. | Added server-side staff/room conflict validation returning `409`. | API smoke conflict assertion |
| Inventory | Stock movement history was local-only. | No movement table existed. | Added `InventoryMovement` schema/table, seed support, API movement endpoint. | API smoke movement |
| Settings | Business configuration was local-only. | No persisted settings model. | Added `SystemSetting` schema/table and `/api/settings`. | Build and settings API path |
| Marketing | Delivery counts updated locally after send. | `/api/marketing/send` did not persist campaign results. | Persisted sent/partial status, credits, and audit log after delivery/dry-run. | Build/API path |
| Online Booking | Public booking only appended local client/lead/appointment state. | No public booking API. | Added transactional public booking endpoint creating/reusing client, lead, appointment, and audit log. | API smoke public booking |
| Responsive build | `src/main.jsx` imported a missing stylesheet. | Missing `src/responsive-app.css`. | Added responsive stylesheet with mobile/tablet layout rules. | `pnpm build` |
| Automated tests | No test script existed. | `package.json` had no test command. | Added `server/api-smoke-test.js` and `pnpm test`. | `pnpm test` |

## Remaining Blockers

- Production authentication is missing. The app still uses a local role picker; server checks rely on session headers and are not a secure identity provider.
- Tenant/branch isolation is partial. Server mutation checks enforce simple branch boundaries, but reads are not yet scoped by authenticated tenant/branch.
- Live SMS/email require Twilio and SMTP environment variables.
- File uploads use browser data URLs, not object storage with authorization, size limits, malware scanning, and cleanup.
- Notifications are toasts/UI indicators, not persisted notification records with read/unread state.
- Refunds, returns, held transactions, cash drawer reconciliation, lead conversion, package sale through POS, purchase orders, approval workflows, and full audit diffs remain partial or absent.
- No dedicated lint/typecheck scripts are configured.

## Verification Results

- `pnpm db:generate`: Passed.
- `pnpm db:push`: Passed after stopping the old SQLite-holding API process.
- `pnpm db:seed`: Passed.
- `pnpm exec prisma validate`: Passed.
- `pnpm build`: Passed.
- `pnpm test`: Passed.
- `pnpm lint`: Not configured.
- `pnpm typecheck`: Not configured.
- `pnpm test:e2e`: Not configured.
- API smoke: Passed health, bootstrap, permissions, client CRUD, appointment conflict, inventory movement, package redeem, POS checkout, public booking.
- Browser smoke: App loaded at `http://127.0.0.1:5173/`, bootstrapped SQLite records, and reported no captured console errors.

## Production Readiness Checklist

- Ready for demo: SQLite-backed bootstrap, clients, appointments, services, inventory, POS checkout, packages, leads, staff, expenses, settings, marketing campaign persistence, audit logs, and responsive build.
- Not ready for production: authentication, real tenant isolation, secure uploads, live notification center, complete finance/POS edge workflows, robust E2E suite, and deployment infrastructure.
