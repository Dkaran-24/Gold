-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "desktopImageId" TEXT,
ADD COLUMN     "internalName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mobileImageId" TEXT,
ADD COLUMN     "publication" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "bannerImageId" TEXT,
ADD COLUMN     "coverImageId" TEXT,
ADD COLUMN     "publication" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "HomepageSection" ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ctaLabel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ctaPath" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "desktopImageId" TEXT,
ADD COLUMN     "endsAt" TIMESTAMPTZ(3),
ADD COLUMN     "internalName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mobileImageId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "startsAt" TIMESTAMPTZ(3),
ADD COLUMN     "subtitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'EDITORIAL';

-- CreateTable
CREATE TABLE "HomepageVersion" (
    "id" SERIAL NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomepageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Banner_desktopImageId_idx" ON "Banner"("desktopImageId");

-- CreateIndex
CREATE INDEX "Banner_mobileImageId_idx" ON "Banner"("mobileImageId");

-- CreateIndex
CREATE INDEX "Collection_publication_archivedAt_sortOrder_idx" ON "Collection"("publication", "archivedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "Collection_coverImageId_idx" ON "Collection"("coverImageId");

-- CreateIndex
CREATE INDEX "Collection_bannerImageId_idx" ON "Collection"("bannerImageId");

-- CreateIndex
CREATE INDEX "HomepageSection_productId_idx" ON "HomepageSection"("productId");

-- CreateIndex
CREATE INDEX "HomepageSection_collectionId_idx" ON "HomepageSection"("collectionId");

-- CreateIndex
CREATE INDEX "HomepageSection_desktopImageId_idx" ON "HomepageSection"("desktopImageId");

-- CreateIndex
CREATE INDEX "HomepageSection_mobileImageId_idx" ON "HomepageSection"("mobileImageId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_bannerImageId_fkey" FOREIGN KEY ("bannerImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_desktopImageId_fkey" FOREIGN KEY ("desktopImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_mobileImageId_fkey" FOREIGN KEY ("mobileImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_desktopImageId_fkey" FOREIGN KEY ("desktopImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_mobileImageId_fkey" FOREIGN KEY ("mobileImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve legacy associations while assigning dense deterministic ordering.
WITH ordered AS (SELECT "collectionId", "productId", ROW_NUMBER() OVER (PARTITION BY "collectionId" ORDER BY "position", "productId") - 1 AS n FROM "CollectionProduct")
UPDATE "CollectionProduct" c SET "position" = ordered.n FROM ordered WHERE c."collectionId" = ordered."collectionId" AND c."productId" = ordered."productId";
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_collectionId_position_key" UNIQUE ("collectionId", "position") DEFERRABLE INITIALLY DEFERRED;
DROP INDEX "HomepageSection_position_key";
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_position_key" UNIQUE ("position") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "HomepageSection" ADD CONSTRAINT "HomepageSection_schedule" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt");
