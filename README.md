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
- Supabase bootstrap SQL: `prisma/supabase.sql`
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

## Verified

- `pnpm build`
- `pnpm db:generate`
- `pnpm db:push`
- `pnpm db:seed`
- Clients API health/list/create/update/delete smoke test
