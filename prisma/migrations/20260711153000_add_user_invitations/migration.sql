CREATE TABLE "UserInvitation" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT 'All branches',
  "department" TEXT NOT NULL DEFAULT '',
  "specialty" TEXT NOT NULL DEFAULT '',
  "message" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "failedReason" TEXT NOT NULL DEFAULT '',
  "invitedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");
CREATE INDEX "UserInvitation_email_status_idx" ON "UserInvitation"("email", "status");
CREATE INDEX "UserInvitation_invitedById_createdAt_idx" ON "UserInvitation"("invitedById", "createdAt");
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
