-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WellnessLeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "requestedById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "cancelledAt" DATETIME,
    "confirmedTakenById" TEXT,
    "confirmedTakenAt" DATETIME,
    "deletedById" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WellnessLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_confirmedTakenById_fkey" FOREIGN KEY ("confirmedTakenById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WellnessLeaveRequest" ("cancelledAt", "cancelledById", "confirmedTakenAt", "confirmedTakenById", "createdAt", "daysCount", "employeeId", "endDate", "id", "notes", "requestedById", "startDate", "status") SELECT "cancelledAt", "cancelledById", "confirmedTakenAt", "confirmedTakenById", "createdAt", "daysCount", "employeeId", "endDate", "id", "notes", "requestedById", "startDate", "status" FROM "WellnessLeaveRequest";
DROP TABLE "WellnessLeaveRequest";
ALTER TABLE "new_WellnessLeaveRequest" RENAME TO "WellnessLeaveRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
