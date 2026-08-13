-- Accounts using the reserved .test domain came from the retired demo-user
-- catalog. Remove only those identities; real clinic accounts are preserved.
DELETE FROM "FaceTrackCorrectionRequest"
WHERE "requestedById" IN (
  SELECT "id" FROM "Account" WHERE LOWER("email") LIKE '%@mace.test'
);

DELETE FROM "UserInvitation"
WHERE "invitedById" IN (
  SELECT "id" FROM "Account" WHERE LOWER("email") LIKE '%@mace.test'
);

DELETE FROM "Account"
WHERE LOWER("email") LIKE '%@mace.test';
