-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employeeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeNo" TEXT NOT NULL,
    "officeAssignment" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "salaryGrade" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalaryGradeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "salaryGrade" INTEGER NOT NULL,
    "monthlyAmount" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "AttendanceDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'UNSET',
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "dayCredit" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "timeIn" DATETIME,
    "timeOut" DATETIME,
    "notes" TEXT,
    "editedById" TEXT,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceDay_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellnessLeaveBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "allotted" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WellnessLeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellnessLeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WellnessLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WellnessLeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "timeIn" DATETIME,
    "timeOut" DATETIME,
    "referenceNo" TEXT,
    "attachmentPath" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripAuthorization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TripAuthorization_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BiometricUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BiometricUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PunchRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "biometricUploadId" TEXT NOT NULL,
    "employeeId" TEXT,
    "rawDept" TEXT,
    "rawName" TEXT NOT NULL,
    "rawNo" TEXT,
    "timestamp" DATETIME NOT NULL,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PunchRecord_biometricUploadId_fkey" FOREIGN KEY ("biometricUploadId") REFERENCES "BiometricUpload" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PunchRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_officeAssignment_idx" ON "Employee"("officeAssignment");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryGradeRate_year_salaryGrade_key" ON "SalaryGradeRate"("year", "salaryGrade");

-- CreateIndex
CREATE INDEX "AttendanceDay_date_idx" ON "AttendanceDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_employeeId_date_key" ON "AttendanceDay"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessLeaveBalance_employeeId_year_semester_key" ON "WellnessLeaveBalance"("employeeId", "year", "semester");

-- CreateIndex
CREATE INDEX "TripAuthorization_employeeId_date_idx" ON "TripAuthorization"("employeeId", "date");

-- CreateIndex
CREATE INDEX "PunchRecord_employeeId_timestamp_idx" ON "PunchRecord"("employeeId", "timestamp");
