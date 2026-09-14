/*
  Warnings:

  - You are about to drop the column `fromDuty` on the `EmployeeDaySchedule` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttendanceDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'UNSET',
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "dayCredit" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "amArrival" DATETIME,
    "amArrivalFromDuty" BOOLEAN NOT NULL DEFAULT false,
    "amDeparture" DATETIME,
    "pmArrival" DATETIME,
    "pmDeparture" DATETIME,
    "editedById" TEXT,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceDay_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AttendanceDay" ("amArrival", "amDeparture", "code", "createdAt", "date", "dayCredit", "editedAt", "editedById", "employeeId", "id", "lateMinutes", "pmArrival", "pmDeparture", "source") SELECT "amArrival", "amDeparture", "code", "createdAt", "date", "dayCredit", "editedAt", "editedById", "employeeId", "id", "lateMinutes", "pmArrival", "pmDeparture", "source" FROM "AttendanceDay";
DROP TABLE "AttendanceDay";
ALTER TABLE "new_AttendanceDay" RENAME TO "AttendanceDay";
CREATE INDEX "AttendanceDay_date_idx" ON "AttendanceDay"("date");
CREATE UNIQUE INDEX "AttendanceDay_employeeId_date_key" ON "AttendanceDay"("employeeId", "date");
CREATE TABLE "new_EmployeeDaySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
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
