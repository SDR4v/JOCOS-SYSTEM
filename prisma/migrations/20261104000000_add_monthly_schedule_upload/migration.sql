-- CreateEnum
CREATE TYPE "ScheduleUploadStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PUBLISHED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "canPostSchedule" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EmployeeDateSchedule" ADD COLUMN     "isOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduleUploadId" TEXT;

-- CreateTable
CREATE TABLE "ScheduleUpload" (
    "id" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "document" JSONB NOT NULL,
    "status" "ScheduleUploadStatus" NOT NULL DEFAULT 'DRAFT',
    "returnNote" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleShiftCode" (
    "id" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shift" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleShiftCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleUpload_office_year_month_idx" ON "ScheduleUpload"("office", "year", "month");

-- CreateIndex
CREATE INDEX "ScheduleUpload_status_idx" ON "ScheduleUpload"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleShiftCode_office_code_key" ON "ScheduleShiftCode"("office", "code");

-- CreateIndex
CREATE INDEX "EmployeeDateSchedule_scheduleUploadId_idx" ON "EmployeeDateSchedule"("scheduleUploadId");

-- AddForeignKey
ALTER TABLE "EmployeeDateSchedule" ADD CONSTRAINT "EmployeeDateSchedule_scheduleUploadId_fkey" FOREIGN KEY ("scheduleUploadId") REFERENCES "ScheduleUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleUpload" ADD CONSTRAINT "ScheduleUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleUpload" ADD CONSTRAINT "ScheduleUpload_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
