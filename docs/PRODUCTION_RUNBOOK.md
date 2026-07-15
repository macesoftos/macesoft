# MACE ClinicOS Production Runbook

## Release gate

No release is approved unless CI passes migration deployment, linting, unit/security tests, API integration tests, the production build, dependency audit, and Chromium end-to-end tests. Run `pnpm readiness` in the production runtime; it must report `score: 100`.

## Initial deployment

1. Create separate runtime and direct PostgreSQL credentials with TLS required. The runtime credential should not own the database.
2. Create a private Supabase Storage bucket and set the server-only storage values from `.env.example`.
3. Generate independent secrets for FaceTrack and backup encryption. Store them in the hosting provider's secret manager.
4. For a new database, run `pnpm exec prisma migrate deploy`. The baseline migration creates the complete original schema and later migrations apply invitations, FaceTrack, uploads, branch isolation, password resets, and append-only audit protection.
5. For an existing database originally created with `prisma db push`, first take and verify a backup. Compare the live schema, then mark only migrations whose SQL is already represented with `prisma migrate resolve --applied <migration-name>`. Never mark an unapplied migration as applied.
6. Create the first Owner once with `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_NAME`, and a strong `BOOTSTRAP_OWNER_PASSWORD`, then run `pnpm bootstrap:owner`. The command refuses to run after any account exists. Never run the demo seed in production.
7. Deploy the container behind HTTPS. `/api/health/live` is the liveness probe and `/api/health/ready` is the database readiness probe.

## Backups and restore drills

- Schedule `pnpm backup` at least daily on a host with PostgreSQL client tools and a separate durable backup volume.
- Schedule `pnpm backup:verify` after every backup. Alert on any non-zero exit.
- Perform a quarterly restore drill into an isolated database. Set `BACKUP_FILE` and set `RESTORE_CONFIRM` to the exact encrypted backup filename before running `pnpm restore`.
- Backup files are AES-256-GCM encrypted and accompanied by SHA-256 manifests. Keep the encryption key outside the backup volume.
- Schedule `pnpm assets:cleanup` daily to remove private objects that have remained unreferenced beyond `ASSET_ORPHAN_GRACE_HOURS`.

## Monitoring and incident response

- Collect stdout JSON logs centrally and alert on readiness failures, HTTP 5xx responses, repeated 401/403/429 responses, password-reset delivery failures, and backup failures.
- Retain request IDs at the reverse proxy so application and proxy logs can be correlated.
- On suspected account compromise: disable the account, delete its sessions, rotate provider credentials, preserve audit logs, and review access by request ID and actor ID.
- On a suspected data leak: remove public access, preserve logs and backups, identify affected branches and records, and follow applicable Philippine privacy notification obligations with counsel or the privacy officer.

## Rollback

Application rollback uses the previous immutable container image. Database migrations are forward-only: restore into an isolated database, validate, then switch the runtime connection. Do not manually reverse production migrations without a tested data-preserving migration.

## Acceptance evidence

Before enabling real customer data, record:

- successful CI run and immutable image digest;
- `pnpm readiness` output at 100;
- successful authenticated and branch-restricted user acceptance tests;
- successful encrypted backup plus verification output;
- successful restore drill date and operator;
- HTTPS, storage privacy, SMTP, SMS, log retention, and alert delivery checks;
- privacy notice, consent wording, retention schedule, and authorized role list approved by the business owner/privacy officer.
