-- Preserve user-facing file names and support newest-first Marketing media queries.
ALTER TABLE "UploadAsset" ADD COLUMN "originalName" TEXT NOT NULL DEFAULT '';

CREATE INDEX "UploadAsset_category_branch_createdAt_idx"
ON "UploadAsset"("category", "branch", "createdAt");
