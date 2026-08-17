# Multi-branch migration

Migration `20260817120000_multi_branch_access_control` is additive and is applied by the existing `prisma migrate deploy` release command.

- A single existing MACE organization is created and all accounts and branches are attached to it.
- If production has no branch row, `Mace Davao` is created as the default branch. Otherwise the oldest existing branch is the default.
- Existing non-owner accounts receive an active primary membership for their named branch, falling back to the default branch when the old value is empty or no longer exists.
- Existing branch-owned operational rows with an empty or invalid legacy branch value are attached to the default branch. No business row is deleted.
- Treatments receive a historical branch snapshot from their client, with the default branch as a safe fallback.
- Existing branches start active with every operational module enabled, preserving behavior until an owner changes branch configuration.
- Branch deletion is replaced by archive/reactivate behavior. Historical rows and room relationships are retained.
- Legacy branch-name columns remain in place for existing integrations, with deferred foreign keys on operational records. New access checks resolve stable branch IDs before using those compatibility fields.

Before deployment, take and verify the normal database backup. After deployment, sign in as an Owner or Super Admin, review branch codes and contact details, then adjust enabled modules and assignments from Branch Management.
