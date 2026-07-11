# MACE ClinicOS

A local Vite/React aesthetic clinic management system with a vertical clinic sidebar, SQLite database foundation, Express API, Prisma schema, and seeded demo records.

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

- SQLite file: `prisma/dev.db`
- Schema: `prisma/schema.prisma`
- SQL initializer: `prisma/init.sql`
- Seed data: `server/seed.js`

The local `pnpm db:push` command initializes the SQLite schema from `prisma/init.sql`. This avoids the Windows schema-engine failure observed with Prisma 7 `db push` while keeping Prisma Client for API queries.

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
