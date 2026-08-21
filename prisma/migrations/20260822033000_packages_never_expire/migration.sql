-- MACE service packages do not expire. Preserve completed packages and
-- reactivate unfinished records that were previously marked expired.
UPDATE "ClinicPackage"
SET
  "expires" = '',
  "status" = CASE
    WHEN "status" = 'Expired' AND "used" < "sessions" THEN 'Active'
    WHEN "status" = 'Expired' THEN 'Completed'
    ELSE "status"
  END
WHERE "expires" <> '' OR "status" = 'Expired';
