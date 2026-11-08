-- CreateEnum
CREATE TYPE "TryOnKind" AS ENUM ('EARRINGS', 'NECKLACE');

-- CreateEnum
CREATE TYPE "TryOnStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "TryOnConfiguration" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "photoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "arEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxUploadMb" INTEGER NOT NULL DEFAULT 10,
    "retentionHours" INTEGER NOT NULL DEFAULT 24,
    "dailyLimit" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TryOnConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTryOnAsset" (
    "productId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "kind" "TryOnKind" NOT NULL DEFAULT 'EARRINGS',
    "overlayImageId" TEXT,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "offsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "offsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductTryOnAsset_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "TryOnJob" (
    "id" UUID NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "kind" "TryOnKind" NOT NULL,
    "referenceUrl" TEXT NOT NULL,
    "ownerHash" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "grantSecret" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentAt" TIMESTAMPTZ(3) NOT NULL,
    "inputMime" TEXT NOT NULL,
    "inputBytes" INTEGER NOT NULL,
    "resultMime" TEXT,
    "resultBytes" INTEGER,
    "status" "TryOnStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "TryOnJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TryOnUsage" (
    "jobId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "TryOnStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TryOnUsage_pkey" PRIMARY KEY ("jobId","attempt")
);

-- CreateTable
CREATE TABLE "_CategoryToTryOnConfiguration" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CategoryToTryOnConfiguration_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ProductTryOnAsset_overlayImageId_idx" ON "ProductTryOnAsset"("overlayImageId");

-- CreateIndex
CREATE INDEX "TryOnJob_status_createdAt_idx" ON "TryOnJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TryOnJob_expiresAt_idx" ON "TryOnJob"("expiresAt");

-- CreateIndex
CREATE INDEX "TryOnJob_productId_idx" ON "TryOnJob"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TryOnJob_ownerHash_requestKey_key" ON "TryOnJob"("ownerHash", "requestKey");

-- CreateIndex
CREATE INDEX "TryOnUsage_createdAt_idx" ON "TryOnUsage"("createdAt");

-- CreateIndex
CREATE INDEX "TryOnUsage_status_idx" ON "TryOnUsage"("status");

-- CreateIndex
CREATE INDEX "_CategoryToTryOnConfiguration_B_index" ON "_CategoryToTryOnConfiguration"("B");

-- AddForeignKey
ALTER TABLE "ProductTryOnAsset" ADD CONSTRAINT "ProductTryOnAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTryOnAsset" ADD CONSTRAINT "ProductTryOnAsset_overlayImageId_fkey" FOREIGN KEY ("overlayImageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TryOnJob" ADD CONSTRAINT "TryOnJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToTryOnConfiguration" ADD CONSTRAINT "_CategoryToTryOnConfiguration_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToTryOnConfiguration" ADD CONSTRAINT "_CategoryToTryOnConfiguration_B_fkey" FOREIGN KEY ("B") REFERENCES "TryOnConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Keep all caller-controlled limits bounded for every writer.
ALTER TABLE "TryOnConfiguration" ADD CONSTRAINT "TryOnConfiguration_limits" CHECK
  ("id" = 1 AND "maxUploadMb" BETWEEN 1 AND 20 AND "retentionHours" BETWEEN 1 AND 72 AND "dailyLimit" BETWEEN 1 AND 10000);
ALTER TABLE "ProductTryOnAsset" ADD CONSTRAINT "ProductTryOnAsset_calibration" CHECK
  ("scale" BETWEEN 0.1 AND 3 AND "offsetX" BETWEEN -1 AND 1 AND "offsetY" BETWEEN -1 AND 1 AND "rotation" BETWEEN -180 AND 180);
ALTER TABLE "TryOnJob" ADD CONSTRAINT "TryOnJob_bounds" CHECK
  ("attempt" BETWEEN 1 AND 2 AND "inputBytes" > 0 AND "expiresAt" > "createdAt");
