-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmployeeDaySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "fromDuty" BOOLEAN NOT NULL DEFAULT false,
    "session1Start" INTEGER,
    "session1End" INTEGER,
    "session2Start" INTEGER,
    "session2End" INTEGER,
    CONSTRAINT "EmployeeDaySchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EmployeeDaySchedule" ("dayOfWeek", "employeeId", "id", "session1End", "session1Start", "session2End", "session2Start") SELECT "dayOfWeek", "employeeId", "id", "session1End", "session1Start", "session2End", "session2Start" FROM "EmployeeDaySchedule";
DROP TABLE "EmployeeDaySchedule";
ALTER TABLE "new_EmployeeDaySchedule" RENAME TO "EmployeeDaySchedule";
CREATE UNIQUE INDEX "EmployeeDaySchedule_employeeId_dayOfWeek_key" ON "EmployeeDaySchedule"("employeeId", "dayOfWeek");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
