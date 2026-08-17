-- Keep deleted Marketing images recoverable until an explicit permanent deletion.
ALTER TABLE "UploadAsset" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "UploadAsset_category_branch_deletedAt_createdAt_idx"
ON "UploadAsset"("category", "branch", "deletedAt", "createdAt");
