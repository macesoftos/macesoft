# MaceSoft Production Readiness Audit

Updated: 2026-07-13

## Repository readiness: 100/100

This score means every repository-controlled release gate is implemented and automated. It does not replace the required deployment acceptance evidence in `docs/PRODUCTION_RUNBOOK.md`; real customer data remains prohibited until the deployed environment itself reports `pnpm readiness` at 100 and backup, restore, HTTPS, provider, privacy, and user-acceptance evidence is recorded.

| Area | Score | Evidence |
|---|---:|---|
| Features and workflows | 100% | Clinic modules persist through PostgreSQL APIs; transactional POS, booking, lead, inventory, package, attendance, and invitation workflows are present. |
| UI and responsiveness | 100% | Production Vite build, responsive layouts, PWA shell, and Chromium customer-flow tests are configured. |
| Database and transactions | 100% | Prisma validates; a clean baseline plus forward migrations are present; critical writes use transactions; audit rows are database-enforced append-only. |
| Authentication and security | 100% | Deny-by-default APIs, HttpOnly sessions, CSRF header enforcement, strict CORS/CSP, role and branch isolation, stored-record authorization, rate limits, password reset, patched dependencies, private object storage, and encrypted biometrics. |
| Automated testing | 100% | Unit, security-boundary, API integration, clean-migration, dependency-audit, build, and Chromium E2E gates run in CI. |
| Deployment and operations | 100% | Non-root container, startup config validation, liveness/readiness probes, structured request logs, encrypted backup/verify/restore, asset cleanup, readiness scoring, and production runbook. |

## Closed critical paths

- Anonymous `/api/bootstrap`, clients, settings, and generic resource reads now return `401` before database access.
- Authenticated reads return only modules permitted for the role and records permitted for the account branch.
- Update/delete authorization uses the stored record branch, preventing an attacker from changing a payload branch to cross the boundary.
- Browser mutations require the authenticated session plus an application-only header; production trusted identity headers are forbidden.
- Patient, treatment, lead, transaction, and audit payloads are no longer persisted in browser local storage and are cleared from legacy keys.
- Images use private object storage with authenticated proxy reads, signature/type/size validation, branch authorization, and orphan cleanup.
- FaceTrack kiosk credentials use a scoped HttpOnly cookie, while administrator FaceTrack routes pass through the main session/CSRF boundary.
- Audit records are read-only in the API and protected from update/delete by a PostgreSQL trigger.

## Required commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:release
pnpm build
pnpm audit --prod --audit-level low
pnpm test:e2e
pnpm readiness
```

CI supplies an isolated PostgreSQL database for migrations, seed data, API integration, and browser tests. Production supplies real provider credentials, private storage, PostgreSQL client tools, and a separate encrypted-backup volume for the final readiness command.

## Verification snapshot

On 2026-07-13, `pnpm check` passed lint, type checking, all 16 unit/security tests, and the production build; `pnpm audit --prod --audit-level low` reported no known vulnerabilities. `pnpm test:release` also passed clean migrations, production-style seed, API integration, and both Chromium end-to-end flows against an isolated PostgreSQL schema, then removed that schema.

The current developer workstation reports `pnpm readiness` at 58/100 because it intentionally has no production origin, FaceTrack encryption secret, private-storage credentials, backup directory/key, or local `pg_dump`/`pg_restore`. Those are deployment inputs, not values that may be fabricated or committed. The supplied production container includes the PostgreSQL client tools; the remaining secrets and provider endpoints must be injected by the production operator before real customer use.
