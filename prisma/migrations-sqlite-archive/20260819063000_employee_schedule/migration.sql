-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeNo" TEXT NOT NULL,
    "officeAssignment" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "salaryGrade" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "scheduleMode" TEXT NOT NULL DEFAULT 'STANDARD',
    "session1Start" INTEGER,
    "session1End" INTEGER,
    "session2Start" INTEGER,
    "session2End" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Employee" ("createdAt", "employeeNo", "id", "name", "officeAssignment", "positionTitle", "salaryGrade", "status", "updatedAt") SELECT "createdAt", "employeeNo", "id", "name", "officeAssignment", "positionTitle", "salaryGrade", "status", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNo_key" ON "Employee"("employeeNo");
CREATE INDEX "Employee_officeAssignment_idx" ON "Employee"("officeAssignment");
CREATE INDEX "Employee_status_idx" ON "Employee"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
