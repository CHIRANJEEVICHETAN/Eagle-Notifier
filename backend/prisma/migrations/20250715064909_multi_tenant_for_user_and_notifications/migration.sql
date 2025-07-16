/*
  Warnings:

  - A unique constraint covering the columns `[parameter,organizationId]` on the table `MeterLimit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,organizationId]` on the table `NotificationSettings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,organizationId]` on the table `Setpoint` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `MeterLimit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `NotificationSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Setpoint` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MeterLimit_parameter_key";

-- DropIndex
DROP INDEX "NotificationSettings_userId_key";

-- AlterTable
ALTER TABLE "MeterLimit" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "NotificationSettings" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Setpoint" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MeterLimit_parameter_organizationId_key" ON "MeterLimit"("parameter", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_organizationId_key" ON "NotificationSettings"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Setpoint_name_organizationId_key" ON "Setpoint"("name", "organizationId");

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setpoint" ADD CONSTRAINT "Setpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterLimit" ADD CONSTRAINT "MeterLimit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
