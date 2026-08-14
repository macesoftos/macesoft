-- CreateTable
CREATE TABLE "Flipbook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pageCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "branch" TEXT NOT NULL DEFAULT 'All branches',
    "assetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "publicToken" TEXT,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flipbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlipbookView" (
    "id" TEXT NOT NULL,
    "flipbookId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlipbookView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlipbookAccessGrant" (
    "id" TEXT NOT NULL,
    "flipbookId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlipbookAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlipbookWorkspaceSetting" (
    "id" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "businessName" TEXT NOT NULL DEFAULT 'MACE',
    "viewerBackground" TEXT NOT NULL DEFAULT '#f4f1ed',
    "defaultAccess" TEXT NOT NULL DEFAULT 'Anyone with the link',
    "defaultAllowDownload" BOOLEAN NOT NULL DEFAULT false,
    "defaultExpirationDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlipbookWorkspaceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Flipbook_assetId_key" ON "Flipbook"("assetId");
CREATE UNIQUE INDEX "Flipbook_publicToken_key" ON "Flipbook"("publicToken");
CREATE INDEX "Flipbook_branch_updatedAt_idx" ON "Flipbook"("branch", "updatedAt");
CREATE INDEX "Flipbook_status_publicEnabled_idx" ON "Flipbook"("status", "publicEnabled");
CREATE INDEX "Flipbook_createdById_idx" ON "Flipbook"("createdById");
CREATE INDEX "FlipbookView_flipbookId_viewedAt_idx" ON "FlipbookView"("flipbookId", "viewedAt");
CREATE INDEX "FlipbookView_flipbookId_viewerKey_idx" ON "FlipbookView"("flipbookId", "viewerKey");
CREATE UNIQUE INDEX "FlipbookAccessGrant_tokenHash_key" ON "FlipbookAccessGrant"("tokenHash");
CREATE INDEX "FlipbookAccessGrant_flipbookId_expiresAt_idx" ON "FlipbookAccessGrant"("flipbookId", "expiresAt");
CREATE INDEX "FlipbookAccessGrant_expiresAt_idx" ON "FlipbookAccessGrant"("expiresAt");

-- AddForeignKey
ALTER TABLE "Flipbook" ADD CONSTRAINT "Flipbook_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "UploadAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Flipbook" ADD CONSTRAINT "Flipbook_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlipbookView" ADD CONSTRAINT "FlipbookView_flipbookId_fkey" FOREIGN KEY ("flipbookId") REFERENCES "Flipbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlipbookAccessGrant" ADD CONSTRAINT "FlipbookAccessGrant_flipbookId_fkey" FOREIGN KEY ("flipbookId") REFERENCES "Flipbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep Supabase PostgREST roles denied; the Express API is the only trusted data path.
ALTER TABLE "Flipbook" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "Flipbook" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
ALTER TABLE "FlipbookView" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "FlipbookView" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
ALTER TABLE "FlipbookAccessGrant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "FlipbookAccessGrant" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
ALTER TABLE "FlipbookWorkspaceSetting" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "FlipbookWorkspaceSetting" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
