-- CreateTable
CREATE TABLE "IgnoredBiometricName" (
    "id" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "ignoredById" TEXT NOT NULL,
    "ignoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredBiometricName_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IgnoredBiometricName_rawName_key" ON "IgnoredBiometricName"("rawName");

-- AddForeignKey
ALTER TABLE "IgnoredBiometricName" ADD CONSTRAINT "IgnoredBiometricName_ignoredById_fkey" FOREIGN KEY ("ignoredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
