-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "compressedExempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CompressedWorkPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "startedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompressedWorkPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompressedWorkPeriod_startDate_idx" ON "CompressedWorkPeriod"("startDate");

-- AddForeignKey
ALTER TABLE "CompressedWorkPeriod" ADD CONSTRAINT "CompressedWorkPeriod_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
