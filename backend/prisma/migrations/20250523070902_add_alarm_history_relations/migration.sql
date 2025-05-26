-- AlterTable
ALTER TABLE "Alarm" ADD COLUMN     "resolutionMessage" TEXT,
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "AlarmHistory" ADD COLUMN     "resolutionMessage" TEXT,
ADD COLUMN     "resolvedById" TEXT;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlarmHistory" ADD CONSTRAINT "AlarmHistory_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlarmHistory" ADD CONSTRAINT "AlarmHistory_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
