-- CreateTable
CREATE TABLE "FurnaceReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileContent" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "grouping" TEXT NOT NULL,
    "includeThresholds" BOOLEAN NOT NULL DEFAULT true,
    "includeStatusFields" BOOLEAN NOT NULL DEFAULT true,
    "alarmTypes" TEXT[],
    "severityLevels" TEXT[],
    "zones" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "FurnaceReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FurnaceReport" ADD CONSTRAINT "FurnaceReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
