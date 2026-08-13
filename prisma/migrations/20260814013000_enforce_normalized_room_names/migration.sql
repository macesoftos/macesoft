UPDATE "Room"
SET "name" = regexp_replace(btrim("name"), '\s+', ' ', 'g')
WHERE "name" <> regexp_replace(btrim("name"), '\s+', ' ', 'g');

WITH "rankedRooms" AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "branchId", lower("name")
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS "duplicateRank"
  FROM "Room"
  WHERE "status" <> 'Archived'
)
UPDATE "Room"
SET "status" = 'Archived'
FROM "rankedRooms"
WHERE "Room"."id" = "rankedRooms"."id"
  AND "rankedRooms"."duplicateRank" > 1;

CREATE UNIQUE INDEX "Room_branchId_normalized_name_key"
ON "Room" ("branchId", lower("name"))
WHERE "status" <> 'Archived';
