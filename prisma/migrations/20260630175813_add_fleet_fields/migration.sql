/*
  Warnings:

  - A unique constraint covering the columns `[dxNumber]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "dxNumber" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "leaseEndDate" DATETIME;
ALTER TABLE "Vehicle" ADD COLUMN "leasingCompany" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "onboardedDate" DATETIME;
ALTER TABLE "Vehicle" ADD COLUMN "registrationMonth" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "samsaraId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_dxNumber_key" ON "Vehicle"("dxNumber");
