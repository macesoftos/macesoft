# User invitations

## Implementation approach

The invitation feature extends the existing Express session authentication,
Prisma `Account`/`BranchMembership` access model, SMTP provider, `AuditLog`, and
`AppNotification` tables. It does not create a second permission system.

- `UserInvitation` owns the intended organization, role, explicit module and
  permission grants, delivery state, secure token hash, expiry, lifecycle
  actors, and acceptance metadata.
- `UserInvitationBranch` stores concrete branch assignments. “All Branches” is
  never stored as an invitation branch; organization-wide access comes from an
  Owner/Super Admin role.
- Every create, edit, resend, cancel, list, access-management, and acceptance
  operation is authorized and organization/branch scoped by the API. The UI
  consumes server-issued capabilities only as a convenience.
- Invitation tokens contain 256 random bits, are stored as SHA-256 hashes, are
  replaced on edit/resend, and are consumed by a conditional single-use
  transaction.
- Acceptance revalidates active branches, role modules, branch-enabled modules,
  and permissions before creating the account, staff profile, and branch
  memberships.

## Configuration

The existing SMTP variables are used. `APP_ORIGIN` must be the public
application origin in production so email links use
`/accept-invitation?token=...` on the correct host.

- `INVITATION_EXPIRY_DAYS` — defaults to `7`, bounded to 1–30 days.
- `INVITATION_RATE_LIMIT` — defaults to `20` send/edit/resend attempts per IP
  every 15 minutes.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and
  `SMTP_FROM` — existing authenticated email delivery configuration.

## Deployment

1. Back up the production database.
2. Configure `APP_ORIGIN`, SMTP, and the optional invitation settings.
3. Deploy the application normally. The existing start/build flow runs
   `prisma migrate deploy`, including
   `20260817153000_secure_user_invitations`.
4. Sign in as an Owner and verify one employee invitation using a real mailbox.
5. Confirm that the accepted account sees only the selected branch modules.

The migration preserves existing invitation rows, normalizes email addresses,
backfills organization and branch relationships, and safely revokes only older
duplicate pending rows before installing the concurrency-safe partial unique
index.
