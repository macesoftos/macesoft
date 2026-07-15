# MACE ClinicOS

A Vite/React aesthetic clinic management system with a vertical clinic sidebar, Supabase Postgres, an Express API, a Prisma schema, and seeded demo records.

## Run Locally

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open the Vite URL shown in the terminal. If port `5173` is already busy, Vite will choose the next open port.

## Database

- Hosted database: Supabase Postgres
- Prisma schema: `prisma/schema.prisma`
- Versioned production migrations: `prisma/migrations/`
- Legacy schema snapshot (not for deployment): `prisma/supabase.sql`
- Seed data: `server/seed.js`

Copy `.env.example` to `.env`, set the Supabase session-pooler `DATABASE_URL`, and set the direct `DIRECT_URL` used for schema operations. The API never exposes these values to the browser.

## Implemented Foundation

- Clients
- Appointments
- Staff
- Treatments and clinical notes
- Services
- Inventory
- POS sales and sale items
- Packages and gift certificates
- Leads and marketing campaigns
- Branches and rooms
- Expenses
- Audit logs

## Keyboard-first POS

The POS can be operated without leaving the keyboard:

- `Alt+P`: toggle between the POS and My Workspace
- `F2` or `/`: focus catalog search; `Arrow Down` enters the results
- arrow keys + `Enter`: move through catalog items and add the focused item
- `F3`: switch Services/Products; `[` and `]`: change catalog page
- `F4`: edit customer, branch, and staff context
- `F6`: focus the cart; `+`/`-` changes quantity and `Delete` removes the row
- `F8`: continue to payment; `1`–`4` selects Cash, Card, Split, or Package
- `Ctrl+Enter`: post the payment; `Escape`: cancel or return

## Production verification

- `pnpm check`
- `pnpm test:release`
- `pnpm audit --prod --audit-level low`
- `pnpm readiness`

Run `pnpm check` for lint, automated tests, and the production build. CI additionally provisions a clean PostgreSQL database, deploys the full migration chain, seeds isolated test data, runs API integration and Chromium end-to-end tests, and checks production dependencies.

Production deployment uses the included `Dockerfile`, strict environment validation, private object storage, liveness/readiness probes, structured request logs, and encrypted backup/restore scripts. Follow [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md) and require `pnpm readiness` to report 100 before enabling real customer data.
