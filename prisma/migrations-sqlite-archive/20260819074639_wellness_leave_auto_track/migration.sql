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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WellnessLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- cancelledById/cancelledAt start unset for pre-existing rows: the old
-- approvedById/approvedAt recorded who approved (not who cancelled), which
-- isn't a meaningful carry-over now that there's no approval step.
INSERT INTO "new_WellnessLeaveRequest" ("id", "employeeId", "startDate", "endDate", "daysCount", "status", "notes", "requestedById", "createdAt")
SELECT "id", "employeeId", "startDate", "endDate", "daysCount", "status", "notes", "requestedById", "createdAt" FROM "WellnessLeaveRequest";
DROP TABLE "WellnessLeaveRequest";
ALTER TABLE "new_WellnessLeaveRequest" RENAME TO "WellnessLeaveRequest";

-- Fold the old PENDING/APPROVED/REJECTED statuses into the new ACTIVE/CANCELLED model.
UPDATE "WellnessLeaveRequest" SET "status" = 'ACTIVE' WHERE "status" IN ('PENDING', 'APPROVED');
UPDATE "WellnessLeaveRequest" SET "status" = 'CANCELLED' WHERE "status" = 'REJECTED';

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
