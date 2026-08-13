-- Preserve appointments while removing assignments to the deleted original
-- Dr. Aria Tan demo profile. A newly created real staff member with the same
-- display name is not affected.
UPDATE "Appointment" AS appointment
SET "staff" = '',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE appointment."staff" = 'Dr. Aria Tan'
AND NOT EXISTS (
  SELECT 1
  FROM "StaffMember" AS employee
  WHERE employee."name" = appointment."staff"
);
