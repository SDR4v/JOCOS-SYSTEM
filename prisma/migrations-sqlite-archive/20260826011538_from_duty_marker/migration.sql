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
CREATE TABLE "new_DtrEntryRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amArrival" DATETIME,
    "amArrivalFromDuty" BOOLEAN NOT NULL DEFAULT false,
    "amDeparture" DATETIME,
    "pmArrival" DATETIME,
    "pmDeparture" DATETIME,
    "overrideCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    CONSTRAINT "DtrEntryRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DtrEntryRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DtrEntryRequest" ("amArrival", "amDeparture", "date", "employeeId", "id", "overrideCode", "pmArrival", "pmDeparture", "reviewedAt", "reviewedById", "status", "submittedAt") SELECT "amArrival", "amDeparture", "date", "employeeId", "id", "overrideCode", "pmArrival", "pmDeparture", "reviewedAt", "reviewedById", "status", "submittedAt" FROM "DtrEntryRequest";
DROP TABLE "DtrEntryRequest";
ALTER TABLE "new_DtrEntryRequest" RENAME TO "DtrEntryRequest";
CREATE INDEX "DtrEntryRequest_status_idx" ON "DtrEntryRequest"("status");
CREATE UNIQUE INDEX "DtrEntryRequest_employeeId_date_key" ON "DtrEntryRequest"("employeeId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
