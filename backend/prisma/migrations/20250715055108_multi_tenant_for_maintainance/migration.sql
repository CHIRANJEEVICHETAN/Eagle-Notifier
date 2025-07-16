/*
  Warnings:

  - A unique constraint covering the columns `[organizationId]` on the table `SystemSettings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `SystemSettings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_organizationId_key" ON "SystemSettings"("organizationId");

-- AddForeignKey
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
