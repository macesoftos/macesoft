-- Restrict branch-scoped logins to POS. Branch administrators retain only the
-- staff invitation and FaceTrack administration surfaces required to operate
-- their assigned clinics. Organization-wide roles are unchanged.

UPDATE "BranchMembership"
SET "modules" = CASE
  WHEN "role" IN ('Admin', 'Branch Manager')
    THEN '["pos","staff","facetrack-attendance"]'
  ELSE '["pos"]'
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "role" NOT IN ('Owner', 'Business Owner', 'Super Admin');

-- Existing branch Admins may send invitations to any clinic in their
-- organization, but their own login remains limited to assigned memberships.
UPDATE "BranchMembership"
SET "permissions" = '["staff.invite","staff.invite_cross_branch","staff.manage"]',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'Admin'
  AND "status" = 'Active';

UPDATE "UserInvitation"
SET "modules" = CASE
  WHEN "role" IN ('Admin', 'Branch Manager')
    THEN '["pos","staff","facetrack-attendance"]'
  ELSE '["pos"]'
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'Pending'
  AND "role" NOT IN ('Owner', 'Business Owner', 'Super Admin');

UPDATE "UserInvitation"
SET "permissions" = '["staff.invite","staff.invite_cross_branch","staff.manage"]',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'Pending'
  AND "role" = 'Admin';

UPDATE "BranchModule"
SET "enabled" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "moduleId" IN ('pos', 'staff', 'facetrack-attendance');
