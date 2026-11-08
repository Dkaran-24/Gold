-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "AppointmentStatus" ADD VALUE 'RESCHEDULE_PROPOSED';
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EnquiryStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "EnquiryStatus" ADD VALUE 'WAITING_FOR_CUSTOMER';
ALTER TYPE "EnquiryStatus" ADD VALUE 'CLOSED';
ALTER TYPE "EnquiryStatus" ADD VALUE 'SPAM';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "alternativeAt" TIMESTAMPTZ(3),
ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "consentAt" TIMESTAMPTZ(3),
ADD COLUMN     "endsAt" TIMESTAMPTZ(3),
ADD COLUMN     "lookupTokenHash" TEXT,
ADD COLUMN     "occupiedUntil" TIMESTAMPTZ(3),
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "proposedAt" TIMESTAMPTZ(3),
ADD COLUMN     "publicReason" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "visitors" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "callbackAt" TIMESTAMPTZ(3),
ADD COLUMN     "consentAt" TIMESTAMPTZ(3),
ADD COLUMN     "lookupTokenHash" TEXT,
ADD COLUMN     "preferredContact" TEXT NOT NULL DEFAULT 'PHONE',
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "subject" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "EnquiryHistory" ADD COLUMN     "actorId" TEXT;

-- CreateTable
CREATE TABLE "EnquiryImage" (
    "enquiryId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,

    CONSTRAINT "EnquiryImage_pkey" PRIMARY KEY ("enquiryId","imageId")
);

-- CreateTable
CREATE TABLE "AppointmentHistory" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "previous" "AppointmentStatus",
    "next" "AppointmentStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "proposedAt" TIMESTAMPTZ(3),
    "scheduledAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentNote" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowroomAvailability" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL,
    "weekly" JSONB NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "closureDates" TEXT[],
    "whatsappNumber" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShowroomAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnquiryImage_imageId_idx" ON "EnquiryImage"("imageId");

-- CreateIndex
CREATE INDEX "AppointmentHistory_appointmentId_createdAt_idx" ON "AppointmentHistory"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentHistory_actorId_idx" ON "AppointmentHistory"("actorId");

-- CreateIndex
CREATE INDEX "AppointmentNote_appointmentId_createdAt_idx" ON "AppointmentNote"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentNote_authorId_idx" ON "AppointmentNote"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_reference_key" ON "Appointment"("reference");

-- CreateIndex
CREATE INDEX "Appointment_productId_idx" ON "Appointment"("productId");

-- CreateIndex
CREATE INDEX "Appointment_collectionId_idx" ON "Appointment"("collectionId");

-- CreateIndex
CREATE INDEX "Appointment_scheduledAt_occupiedUntil_idx" ON "Appointment"("scheduledAt", "occupiedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_reference_key" ON "Enquiry"("reference");

-- CreateIndex
CREATE INDEX "EnquiryHistory_actorId_idx" ON "EnquiryHistory"("actorId");

-- AddForeignKey
ALTER TABLE "EnquiryHistory" ADD CONSTRAINT "EnquiryHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryImage" ADD CONSTRAINT "EnquiryImage_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryImage" ADD CONSTRAINT "EnquiryImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentNote" ADD CONSTRAINT "AppointmentNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentNote" ADD CONSTRAINT "AppointmentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShowroomAvailability" ADD CONSTRAINT "ShowroomAvailability_valid" CHECK ("id" = 1 AND "durationMinutes" BETWEEN 5 AND 480 AND "bufferMinutes" BETWEEN 0 AND 120 AND "capacity" BETWEEN 1 AND 100);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_valid_visitors" CHECK ("visitors" BETWEEN 1 AND 20);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_valid_window" CHECK ("endsAt" IS NULL OR ("scheduledAt" IS NOT NULL AND "endsAt" > "scheduledAt" AND "occupiedUntil" >= "endsAt"));
