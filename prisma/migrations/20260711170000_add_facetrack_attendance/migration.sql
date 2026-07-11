CREATE TABLE "FaceTrackProfile" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "encryptedDescriptor" TEXT NOT NULL,
  "descriptorVersion" TEXT NOT NULL DEFAULT 'face-api-v1',
  "consentAt" TIMESTAMP(3) NOT NULL,
  "enrolledById" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaceTrackProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaceTrackAttendanceRecord" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "workDate" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT '',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
  "scheduledStart" TIMESTAMP(3) NOT NULL,
  "scheduledEnd" TIMESTAMP(3) NOT NULL,
  "originalTimeIn" TIMESTAMP(3),
  "originalTimeOut" TIMESTAMP(3),
  "timeIn" TIMESTAMP(3),
  "timeOut" TIMESTAMP(3),
  "workedMinutes" INTEGER NOT NULL DEFAULT 0,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "calculatedOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "approvedOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "overtimeStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "verificationMethod" TEXT NOT NULL DEFAULT 'FACE_RECOGNITION',
  "timeInConfidence" DOUBLE PRECISION,
  "timeOutConfidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaceTrackAttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaceTrackCorrectionRequest" (
  "id" TEXT NOT NULL,
  "attendanceRecordId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "requestedTimeIn" TIMESTAMP(3),
  "requestedTimeOut" TIMESTAMP(3),
  "originalTimeIn" TIMESTAMP(3),
  "originalTimeOut" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "attachmentUrl" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "adminComment" TEXT NOT NULL DEFAULT '',
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaceTrackCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaceTrackAuditEntry" (
  "id" TEXT NOT NULL,
  "attendanceRecordId" TEXT NOT NULL,
  "correctionRequestId" TEXT,
  "actorAccountId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "originalValues" TEXT NOT NULL DEFAULT '{}',
  "requestedValues" TEXT NOT NULL DEFAULT '{}',
  "finalValues" TEXT NOT NULL DEFAULT '{}',
  "reason" TEXT NOT NULL DEFAULT '',
  "comment" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceTrackAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaceTrackChallenge" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceTrackChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaceTrackPolicy" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
  "graceMinutes" INTEGER NOT NULL DEFAULT 5,
  "matchThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "overtimeMinimumMinutes" INTEGER NOT NULL DEFAULT 30,
  "overtimeRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "retentionDays" INTEGER NOT NULL DEFAULT 730,
  "updatedBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaceTrackPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FaceTrackProfile_staffId_key" ON "FaceTrackProfile"("staffId");
CREATE INDEX "FaceTrackProfile_active_idx" ON "FaceTrackProfile"("active");
CREATE UNIQUE INDEX "FaceTrackAttendanceRecord_staffId_workDate_key" ON "FaceTrackAttendanceRecord"("staffId", "workDate");
CREATE INDEX "FaceTrackAttendanceRecord_workDate_idx" ON "FaceTrackAttendanceRecord"("workDate");
CREATE INDEX "FaceTrackAttendanceRecord_branch_workDate_idx" ON "FaceTrackAttendanceRecord"("branch", "workDate");
CREATE INDEX "FaceTrackAttendanceRecord_status_idx" ON "FaceTrackAttendanceRecord"("status");
CREATE INDEX "FaceTrackAttendanceRecord_overtimeStatus_idx" ON "FaceTrackAttendanceRecord"("overtimeStatus");
CREATE INDEX "FaceTrackCorrectionRequest_attendanceRecordId_idx" ON "FaceTrackCorrectionRequest"("attendanceRecordId");
CREATE INDEX "FaceTrackCorrectionRequest_requestedById_status_idx" ON "FaceTrackCorrectionRequest"("requestedById", "status");
CREATE INDEX "FaceTrackCorrectionRequest_status_createdAt_idx" ON "FaceTrackCorrectionRequest"("status", "createdAt");
CREATE INDEX "FaceTrackAuditEntry_attendanceRecordId_createdAt_idx" ON "FaceTrackAuditEntry"("attendanceRecordId", "createdAt");
CREATE INDEX "FaceTrackAuditEntry_correctionRequestId_idx" ON "FaceTrackAuditEntry"("correctionRequestId");
CREATE UNIQUE INDEX "FaceTrackChallenge_nonceHash_key" ON "FaceTrackChallenge"("nonceHash");
CREATE INDEX "FaceTrackChallenge_accountId_purpose_idx" ON "FaceTrackChallenge"("accountId", "purpose");
CREATE INDEX "FaceTrackChallenge_expiresAt_idx" ON "FaceTrackChallenge"("expiresAt");

ALTER TABLE "FaceTrackProfile" ADD CONSTRAINT "FaceTrackProfile_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceTrackProfile" ADD CONSTRAINT "FaceTrackProfile_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaceTrackAttendanceRecord" ADD CONSTRAINT "FaceTrackAttendanceRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceTrackCorrectionRequest" ADD CONSTRAINT "FaceTrackCorrectionRequest_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "FaceTrackAttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceTrackCorrectionRequest" ADD CONSTRAINT "FaceTrackCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FaceTrackCorrectionRequest" ADD CONSTRAINT "FaceTrackCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaceTrackAuditEntry" ADD CONSTRAINT "FaceTrackAuditEntry_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "FaceTrackAttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceTrackChallenge" ADD CONSTRAINT "FaceTrackChallenge_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
