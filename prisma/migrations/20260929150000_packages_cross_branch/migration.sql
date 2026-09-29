-- Client packages and service credits follow the client across clinic branches.
ALTER TABLE "ClinicPackage"
  ALTER COLUMN "transferable" SET DEFAULT true;

UPDATE "ClinicPackage"
SET "branch" = 'All branches', "transferable" = true, "expires" = ''
WHERE "branch" <> 'All branches' OR "transferable" = false OR "expires" <> '';
