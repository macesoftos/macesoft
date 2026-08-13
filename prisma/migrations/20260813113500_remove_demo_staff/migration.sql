-- Remove only the five original demo staff profiles. Real staff use generated
-- IDs, so a later employee with a similar name is never affected.
DELETE FROM "StaffMember"
WHERE "id" IN ('st-dr-mace', 'st-aria', 'st-ana', 'st-bea', 'st-ria');

-- Keep the branch summary in sync with the remaining real staff profiles.
UPDATE "Branch" AS branch
SET "staff" = (
  SELECT COUNT(*)::INTEGER
  FROM "StaffMember" AS employee
  WHERE employee."branch" = branch."name"
),
"updatedAt" = CURRENT_TIMESTAMP;
