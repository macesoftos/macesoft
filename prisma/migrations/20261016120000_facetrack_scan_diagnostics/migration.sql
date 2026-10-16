CREATE TABLE "FaceTrackScanDiagnostic" (
  "id" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "scannerType" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "failureStage" TEXT NOT NULL DEFAULT '',
  "failureCode" TEXT NOT NULL DEFAULT '',
  "elapsedMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceTrackScanDiagnostic_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FaceTrackScanDiagnostic_branch_createdAt_idx"
  ON "FaceTrackScanDiagnostic"("branch", "createdAt");
CREATE INDEX "FaceTrackScanDiagnostic_outcome_createdAt_idx"
  ON "FaceTrackScanDiagnostic"("outcome", "createdAt");
CREATE INDEX "FaceTrackScanDiagnostic_failureCode_createdAt_idx"
  ON "FaceTrackScanDiagnostic"("failureCode", "createdAt");

ALTER TABLE "FaceTrackScanDiagnostic" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "FaceTrackScanDiagnostic" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
