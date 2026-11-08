-- REVIEW ONLY: do not apply without separate approval.
-- Additive only: no backfill, no changes to ProductImage or ProductTryOnAsset rows.
CREATE TABLE "TryOnOverlay" (
    "productId" TEXT NOT NULL,
    "kind" "TryOnKind" NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'png',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "validatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "TryOnOverlay_pkey" PRIMARY KEY ("productId")
);

CREATE UNIQUE INDEX "TryOnOverlay_publicId_key" ON "TryOnOverlay"("publicId");

ALTER TABLE "TryOnOverlay" ADD CONSTRAINT "TryOnOverlay_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ProductTryOnAsset"("productId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
