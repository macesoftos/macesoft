-- Cutoff payroll, structured commissions, salary deductions, and schedule inputs.
CREATE TABLE "PayrollEmployeeProfile" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "payType" TEXT NOT NULL DEFAULT 'Monthly',
  "monthlySalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "periodsPerMonth" INTEGER NOT NULL DEFAULT 2,
  "standardWorkDays" INTEGER NOT NULL DEFAULT 26,
  "standardMinutesPerDay" INTEGER NOT NULL DEFAULT 480,
  "overtimeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.25,
  "workDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',
  "paidLeaveCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "updatedBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollEmployeeProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollScheduleEntry" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "workDate" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'Work Day',
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "scheduledMinutes" INTEGER NOT NULL DEFAULT 480,
  "status" TEXT NOT NULL DEFAULT 'Approved',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL DEFAULT '',
  "approvedById" TEXT NOT NULL DEFAULT '',
  "approvedBy" TEXT NOT NULL DEFAULT '',
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollScheduleEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cutoffStart" TEXT NOT NULL,
  "cutoffEnd" TEXT NOT NULL,
  "payDate" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT 'All branches',
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "notes" TEXT NOT NULL DEFAULT '',
  "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL DEFAULT '',
  "approvedBy" TEXT NOT NULL DEFAULT '',
  "approvedAt" TIMESTAMP(3),
  "finalizedById" TEXT NOT NULL DEFAULT '',
  "finalizedBy" TEXT NOT NULL DEFAULT '',
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollLine" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "staffName" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "scheduledDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "workedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "regularMinutes" INTEGER NOT NULL DEFAULT 0,
  "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "undertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "absenceDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidLeaveDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dayOffDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "basePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overtimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "incentives" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salaryDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "calculationDetails" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollAdjustment" (
  "id" TEXT NOT NULL,
  "payrollLineId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "serviceId" TEXT,
  "branch" TEXT NOT NULL DEFAULT 'All branches',
  "ruleType" TEXT NOT NULL DEFAULT 'Percentage',
  "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountedRuleType" TEXT NOT NULL DEFAULT '',
  "discountedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "packageBasis" TEXT NOT NULL DEFAULT 'Session Value',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TEXT NOT NULL DEFAULT '',
  "effectiveTo" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollCommissionEarning" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "payrollLineId" TEXT,
  "staffId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "saleItemId" TEXT NOT NULL,
  "serviceId" TEXT,
  "sourceDate" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "ruleName" TEXT NOT NULL,
  "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "details" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollCommissionEarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollSalaryDeduction" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "payrollLineId" TEXT,
  "staffId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "saleInvoice" TEXT NOT NULL,
  "sourceDate" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "details" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollSalaryDeduction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollEmployeeProfile_staffId_key" ON "PayrollEmployeeProfile"("staffId");
CREATE INDEX "PayrollEmployeeProfile_active_idx" ON "PayrollEmployeeProfile"("active");
CREATE UNIQUE INDEX "PayrollScheduleEntry_staffId_workDate_key" ON "PayrollScheduleEntry"("staffId", "workDate");
CREATE INDEX "PayrollScheduleEntry_workDate_status_idx" ON "PayrollScheduleEntry"("workDate", "status");
CREATE INDEX "PayrollScheduleEntry_branch_workDate_idx" ON "PayrollScheduleEntry"("branch", "workDate");
CREATE UNIQUE INDEX "PayrollRun_organizationId_cutoffStart_cutoffEnd_branch_key" ON "PayrollRun"("organizationId", "cutoffStart", "cutoffEnd", "branch");
CREATE INDEX "PayrollRun_organizationId_status_cutoffEnd_idx" ON "PayrollRun"("organizationId", "status", "cutoffEnd");
CREATE INDEX "PayrollRun_branch_cutoffStart_cutoffEnd_idx" ON "PayrollRun"("branch", "cutoffStart", "cutoffEnd");
CREATE UNIQUE INDEX "PayrollLine_payrollRunId_staffId_key" ON "PayrollLine"("payrollRunId", "staffId");
CREATE INDEX "PayrollLine_staffId_payrollRunId_idx" ON "PayrollLine"("staffId", "payrollRunId");
CREATE INDEX "PayrollAdjustment_payrollLineId_type_idx" ON "PayrollAdjustment"("payrollLineId", "type");
CREATE UNIQUE INDEX "CommissionRule_organizationId_role_serviceId_branch_key" ON "CommissionRule"("organizationId", "role", "serviceId", "branch");
CREATE INDEX "CommissionRule_organizationId_active_role_idx" ON "CommissionRule"("organizationId", "active", "role");
CREATE INDEX "CommissionRule_serviceId_idx" ON "CommissionRule"("serviceId");
CREATE UNIQUE INDEX "PayrollCommissionEarning_sourceKey_key" ON "PayrollCommissionEarning"("sourceKey");
CREATE UNIQUE INDEX "PayrollCommissionEarning_saleItemId_key" ON "PayrollCommissionEarning"("saleItemId");
CREATE INDEX "PayrollCommissionEarning_staffId_sourceDate_status_idx" ON "PayrollCommissionEarning"("staffId", "sourceDate", "status");
CREATE INDEX "PayrollCommissionEarning_payrollLineId_idx" ON "PayrollCommissionEarning"("payrollLineId");
CREATE UNIQUE INDEX "PayrollSalaryDeduction_sourceKey_key" ON "PayrollSalaryDeduction"("sourceKey");
CREATE INDEX "PayrollSalaryDeduction_staffId_sourceDate_status_idx" ON "PayrollSalaryDeduction"("staffId", "sourceDate", "status");
CREATE INDEX "PayrollSalaryDeduction_payrollLineId_idx" ON "PayrollSalaryDeduction"("payrollLineId");

ALTER TABLE "PayrollEmployeeProfile" ADD CONSTRAINT "PayrollEmployeeProfile_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollScheduleEntry" ADD CONSTRAINT "PayrollScheduleEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollCommissionEarning" ADD CONSTRAINT "PayrollCommissionEarning_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollCommissionEarning" ADD CONSTRAINT "PayrollCommissionEarning_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollCommissionEarning" ADD CONSTRAINT "PayrollCommissionEarning_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollCommissionEarning" ADD CONSTRAINT "PayrollCommissionEarning_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollCommissionEarning" ADD CONSTRAINT "PayrollCommissionEarning_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryDeduction" ADD CONSTRAINT "PayrollSalaryDeduction_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryDeduction" ADD CONSTRAINT "PayrollSalaryDeduction_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollSalaryDeduction" ADD CONSTRAINT "PayrollSalaryDeduction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BranchModule" ("id", "branchId", "moduleId", "enabled", "createdAt", "updatedAt")
SELECT 'payroll-' || "id", "id", 'payroll', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Branch"
ON CONFLICT ("branchId", "moduleId") DO NOTHING;

UPDATE "Account"
SET "organizationModules" = ("organizationModules"::jsonb || '["payroll"]'::jsonb)::text,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" IN ('Super Admin', 'Owner', 'Business Owner')
  AND LEFT(TRIM("organizationModules"), 1) = '['
  AND NOT ("organizationModules"::jsonb ? 'payroll');

ALTER TABLE "PayrollEmployeeProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollScheduleEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommissionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollCommissionEarning" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollSalaryDeduction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_direct_api_access" ON "PayrollEmployeeProfile" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "PayrollScheduleEntry" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "PayrollRun" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "PayrollLine" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "PayrollAdjustment" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "CommissionRule" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "PayrollCommissionEarning" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "PayrollSalaryDeduction" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
