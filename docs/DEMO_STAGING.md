# Sales demo staging

The sales demo runs as a separate Hostinger Web App and uses an isolated PostgreSQL schema. It must never point at the production `public` schema.

## Database preparation

1. Choose a schema name beginning with `macesoft_demo_`, such as `macesoft_demo_sales`.
2. Add `?schema=macesoft_demo_sales` to both the runtime and direct PostgreSQL URLs.
3. Set `DEMO_SEED_CONFIRM=macesoft_demo_sales` in the one-time setup shell.
4. Provide a demo-only owner password, then run the guarded preparation command:

```bash
DEMO_SCHEMA=macesoft_demo_sales \
DEMO_OWNER_PASSWORD='<demo-only password>' \
pnpm demo:prepare
```

The demo seeder refuses `public`, refuses schemas outside the `macesoft_demo_*` namespace, requires an exact confirmation value, and refuses to run when `NODE_ENV=production`.

## Hostinger runtime

Use a separate Web App connected to the demo Git branch. Required demo-specific values:

```text
APP_ORIGIN=https://demo.macebydrmace.com
NODE_ENV=production
VITE_DEMO_MODE=true
VITE_DEMO_EMAIL=demo@macesoft.app
VITE_DEMO_PASSWORD=<demo-only password>
VITE_DEMO_PRODUCT_NAME=MaceSoft ClinicOS Demo
REQUIRE_OBJECT_STORAGE=false
REQUIRE_MARKETING_PROVIDERS=false
MARKETING_DRY_RUN=false
```

Set `DATABASE_URL` and `DIRECT_URL` to the isolated schema URLs, and use a unique 32+ character `FACETRACK_ENCRYPTION_KEY`. Demo credentials must never be reused for production.

## Refreshing the demo

Run `pnpm demo:prepare` again with the same isolated schema. The base seed clears only that schema and the guarded demo seed repopulates fictional, date-relative sample records.
