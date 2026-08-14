-- Disconnect the one confirmed bad production mapping without deleting the
-- employee, the admin account, or either identity's historical records.
UPDATE "Account" AS account
SET "staffId" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE account."id" = 'cmrm1fimh00001cpno59o8ver'
  AND account."name" = 'MACE Admin'
  AND account."role" = 'Super Admin'
  AND account."staffId" = 'st-msre8oed-yz72s'
  AND EXISTS (
    SELECT 1
    FROM "StaffMember" AS staff
    WHERE staff."id" = account."staffId"
      AND staff."name" = 'Christina Inah J. Pandian'
      AND staff."role" = 'Marketing Staff'
  );
