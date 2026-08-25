-- Existing self-service demo workspaces were created with a reduced module
-- grant. Expand those private sandboxes to the complete product catalog so
-- current prospects receive the same feature access as newly registered demos.

WITH "demoBranches" AS (
  SELECT DISTINCT bm."branchId"
  FROM "BranchMembership" bm
  INNER JOIN "Account" a ON a."id" = bm."accountId"
  WHERE a."role" = 'Demo User'
)
INSERT INTO "BranchModule" ("id", "branchId", "moduleId", "enabled", "createdAt", "updatedAt")
SELECT
  'bmod-' || md5(db."branchId" || m."moduleId"),
  db."branchId",
  m."moduleId",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "demoBranches" db
CROSS JOIN (VALUES
  ('my-workspace'), ('overview'), ('applications'), ('facetrack-attendance'),
  ('pos'), ('card-view'), ('staff-view'), ('room-view'), ('appointments'),
  ('clients'), ('treatments'), ('services'), ('inventory'), ('packages'),
  ('leads'), ('sms'), ('flipbooks'), ('staff'), ('branches'), ('expenses'),
  ('payroll'), ('reports'), ('booking'), ('settings'), ('support')
) AS m("moduleId")
ON CONFLICT ("branchId", "moduleId") DO UPDATE
SET "enabled" = true, "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "BranchMembership" bm
SET
  "modules" = '["my-workspace","overview","applications","facetrack-attendance","pos","card-view","staff-view","room-view","appointments","clients","treatments","services","inventory","packages","leads","sms","flipbooks","staff","branches","expenses","payroll","reports","booking","settings","support"]',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Account" a
WHERE a."id" = bm."accountId"
  AND a."role" = 'Demo User';

UPDATE "Account"
SET
  "organizationWideAccess" = true,
  "organizationModules" = '["my-workspace","overview","applications","facetrack-attendance","pos","card-view","staff-view","room-view","appointments","clients","treatments","services","inventory","packages","leads","sms","flipbooks","staff","branches","expenses","payroll","reports","booking","settings","support"]',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'Demo User';
