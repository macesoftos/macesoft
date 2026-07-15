ALTER TABLE "GiftCertificate"
ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'All branches';

CREATE INDEX "GiftCertificate_branch_idx" ON "GiftCertificate"("branch");

CREATE TABLE "UploadAsset" (
  "id" TEXT NOT NULL,
  "objectPath" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadAsset_objectPath_key" ON "UploadAsset"("objectPath");
CREATE INDEX "UploadAsset_branch_idx" ON "UploadAsset"("branch");
CREATE INDEX "UploadAsset_category_idx" ON "UploadAsset"("category");
CREATE INDEX "UploadAsset_uploadedById_idx" ON "UploadAsset"("uploadedById");

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_audit_mutation', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_accountId_createdAt_idx" ON "PasswordResetToken"("accountId", "createdAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
