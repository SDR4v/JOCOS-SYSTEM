-- CreateTable
CREATE TABLE "EmployeeDateSchedule" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "session1Start" INTEGER,
    "session1End" INTEGER,
    "session2Start" INTEGER,
    "session2End" INTEGER,

    CONSTRAINT "EmployeeDateSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeDateSchedule_date_idx" ON "EmployeeDateSchedule"("date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDateSchedule_employeeId_date_key" ON "EmployeeDateSchedule"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "EmployeeDateSchedule" ADD CONSTRAINT "EmployeeDateSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
