-- CreateTable
CREATE TABLE "EmployeeDaySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "session1Start" INTEGER,
    "session1End" INTEGER,
    "session2Start" INTEGER,
    "session2End" INTEGER,
    CONSTRAINT "EmployeeDaySchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDaySchedule_employeeId_dayOfWeek_key" ON "EmployeeDaySchedule"("employeeId", "dayOfWeek");
