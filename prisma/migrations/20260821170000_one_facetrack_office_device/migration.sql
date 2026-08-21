-- FaceTrack attendance is permitted on one active registered office device per branch.
-- Preserve the most recently registered device if legacy data contains duplicates.
WITH "ranked_active_devices" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "branch"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS "position"
  FROM "FaceTrackKioskDevice"
  WHERE "active" = true
)
UPDATE "FaceTrackKioskDevice" AS "device"
SET
  "active" = false,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ranked_active_devices" AS "ranked"
WHERE "device"."id" = "ranked"."id"
  AND "ranked"."position" > 1;

CREATE UNIQUE INDEX "FaceTrackKioskDevice_one_active_per_branch_key"
ON "FaceTrackKioskDevice" ("branch")
WHERE "active" = true;
