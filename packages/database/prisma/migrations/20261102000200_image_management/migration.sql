ALTER TABLE "ProductImage" ADD COLUMN "format" TEXT,
ADD COLUMN "bytes" INTEGER,
ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_valid_metadata" CHECK
(("format" IS NULL OR "format" IN ('jpeg','png','webp')) AND ("bytes" IS NULL OR "bytes" > 0));
-- Allow atomic gallery permutations without temporary invalid/duplicate positions at commit.
DROP INDEX "ProductImage_productId_position_key";
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_position_key"
UNIQUE ("productId", "position") DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE "ImageCleanup" (
  "publicId" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "notBefore" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ImageCleanup_notBefore_idx" ON "ImageCleanup"("notBefore");
