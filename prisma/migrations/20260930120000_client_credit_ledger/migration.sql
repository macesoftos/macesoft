CREATE TABLE "ClientCreditLedger" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "creditType" TEXT NOT NULL DEFAULT 'Client Credit',
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT '',
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'Manual',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientCreditLedger_clientId_createdAt_idx" ON "ClientCreditLedger"("clientId", "createdAt");
CREATE INDEX "ClientCreditLedger_creditType_createdAt_idx" ON "ClientCreditLedger"("creditType", "createdAt");
CREATE INDEX "ClientCreditLedger_branch_createdAt_idx" ON "ClientCreditLedger"("branch", "createdAt");

ALTER TABLE "ClientCreditLedger" ADD CONSTRAINT "ClientCreditLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientCreditLedger" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "ClientCreditLedger" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
