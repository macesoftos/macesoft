-- Preserve the current organization-wide defaults while allowing an explicitly
-- empty module list to mean that an account has no module access.
UPDATE "Account"
SET "organizationModules" = '["my-workspace","overview","applications","facetrack-attendance","pos","card-view","staff-view","room-view","appointments","clients","treatments","services","inventory","packages","leads","sms","flipbooks","staff","branches","expenses","payroll","reports","booking","settings","support"]',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" IN ('Owner', 'Business Owner', 'Super Admin')
  AND "organizationModules" = '[]';

ALTER TABLE "Account" ALTER COLUMN "organizationModules" DROP DEFAULT;
ALTER TABLE "Account" ALTER COLUMN "organizationModules" DROP NOT NULL;
