-- The payroll migration appended "payroll" to organization-level module
-- overrides. For organization managers an empty array means "use every module
-- allowed by the role", so [] became ["payroll"] and unintentionally restricted
-- affected Super Admin/Owner accounts to Payroll only.
--
-- Payroll did not exist before that migration, which makes a payroll-only
-- organization-manager override an unambiguous result of the bad backfill.
-- Restore the empty override so normal role defaults apply again.
UPDATE "Account"
SET "organizationModules" = '[]',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" IN ('Super Admin', 'Owner', 'Business Owner')
  AND LEFT(TRIM("organizationModules"), 1) = '['
  AND "organizationModules"::jsonb = '["payroll"]'::jsonb;
