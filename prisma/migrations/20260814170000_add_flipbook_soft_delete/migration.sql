-- Keep deleted flipbooks recoverable until an explicit permanent deletion.
ALTER TABLE "Flipbook" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Flipbook_branch_deletedAt_idx" ON "Flipbook"("branch", "deletedAt");
