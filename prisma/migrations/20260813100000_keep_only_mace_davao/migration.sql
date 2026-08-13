-- Keep Mace Davao as the single current clinic branch.
-- Existing Mace BGC assignments are preserved by moving them to Mace Davao
-- before the obsolete branch and its rooms are removed.

INSERT INTO "Branch" (
    "id",
    "name",
    "city",
    "address",
    "phone",
    "hours",
    "staff",
    "devices",
    "image",
    "createdAt",
    "updatedAt"
)
SELECT
    'br-davao-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
    'Mace Davao',
    'Davao',
    'Davao City',
    '0917 886 2104',
    '9:00 AM - 7:00 PM',
    0,
    '["Mace Thermatight","Diode Hair Removal","Rejuvelight"]',
    '/brand/clinic-davao.jpg',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "Branch" WHERE "name" = 'Mace Davao'
);

UPDATE "Client" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "StaffMember" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "Account" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "UserInvitation" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "AttendanceEvent" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "FaceTrackAttendanceRecord" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "FaceTrackKioskDevice" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "Appointment" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "InventoryItem" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "InventoryMovement" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "Sale" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "ClinicPackage" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "GiftCertificate" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "Lead" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "Lead" SET "assignedBranch" = 'Mace Davao' WHERE "assignedBranch" = 'Mace BGC';
UPDATE "Expense" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';
UPDATE "UploadAsset" SET "branch" = 'Mace Davao' WHERE "branch" = 'Mace BGC';

UPDATE "Service" AS service
SET "branches" = (
    SELECT COALESCE(jsonb_agg(normalized."name" ORDER BY normalized."position"), '[]'::jsonb)::text
    FROM (
        SELECT branch_name AS "name", MIN(position) AS "position"
        FROM (
            SELECT
                CASE WHEN branch_name = 'Mace BGC' THEN 'Mace Davao' ELSE branch_name END AS branch_name,
                position
            FROM jsonb_array_elements_text(service."branches"::jsonb) WITH ORDINALITY AS branch(branch_name, position)
        ) AS reassigned
        GROUP BY branch_name
    ) AS normalized
)
WHERE service."branches" LIKE '%Mace BGC%';

DELETE FROM "Branch" WHERE "name" = 'Mace BGC';
