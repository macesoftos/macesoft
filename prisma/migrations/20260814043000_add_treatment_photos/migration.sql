-- Treatment photos are stored as private UploadAsset objects and linked to
-- their clinical treatment record. The legacy numeric field is reset because
-- it previously accepted manual counts without any backing image records.

CREATE TABLE "TreatmentPhoto" (
  "id" TEXT NOT NULL,
  "treatmentId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'Clinical',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreatmentPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TreatmentPhoto_assetId_key" ON "TreatmentPhoto"("assetId");
CREATE INDEX "TreatmentPhoto_treatmentId_createdAt_idx" ON "TreatmentPhoto"("treatmentId", "createdAt");

ALTER TABLE "TreatmentPhoto" ADD CONSTRAINT "TreatmentPhoto_treatmentId_fkey"
FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TreatmentPhoto" ADD CONSTRAINT "TreatmentPhoto_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "UploadAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Treatment" SET "photos" = 0;

ALTER TABLE "TreatmentPhoto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "TreatmentPhoto" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
