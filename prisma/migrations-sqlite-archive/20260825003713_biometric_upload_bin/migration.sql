/*
  Warnings:

  - Added the required column `fileData` to the `BiometricUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileSize` to the `BiometricUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `BiometricUpload` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `BiometricUpload` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BiometricUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BLOB NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BiometricUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BiometricUpload" ("filename", "id", "periodEnd", "periodStart", "status", "uploadedAt", "uploadedById") SELECT "filename", "id", "periodEnd", "periodStart", "status", "uploadedAt", "uploadedById" FROM "BiometricUpload";
DROP TABLE "BiometricUpload";
ALTER TABLE "new_BiometricUpload" RENAME TO "BiometricUpload";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
