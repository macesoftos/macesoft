CREATE TABLE "FaceTrackKioskDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FaceTrackKioskDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaceTrackKioskChallenge" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'KIOSK_CLOCK',
    "nonceHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FaceTrackKioskChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FaceTrackKioskDevice_tokenHash_key" ON "FaceTrackKioskDevice"("tokenHash");
CREATE INDEX "FaceTrackKioskDevice_branch_active_idx" ON "FaceTrackKioskDevice"("branch", "active");
CREATE INDEX "FaceTrackKioskDevice_createdById_idx" ON "FaceTrackKioskDevice"("createdById");
CREATE UNIQUE INDEX "FaceTrackKioskChallenge_nonceHash_key" ON "FaceTrackKioskChallenge"("nonceHash");
CREATE INDEX "FaceTrackKioskChallenge_deviceId_purpose_idx" ON "FaceTrackKioskChallenge"("deviceId", "purpose");
CREATE INDEX "FaceTrackKioskChallenge_expiresAt_idx" ON "FaceTrackKioskChallenge"("expiresAt");

ALTER TABLE "FaceTrackKioskChallenge"
ADD CONSTRAINT "FaceTrackKioskChallenge_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "FaceTrackKioskDevice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
