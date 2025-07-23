-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "lastTrainingDate" TIMESTAMP(3),
ADD COLUMN     "mlModelConfig" JSONB,
ADD COLUMN     "modelAccuracy" DOUBLE PRECISION,
ADD COLUMN     "modelVersion" TEXT,
ADD COLUMN     "predictionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trainingSchedule" JSONB;

-- CreateTable
CREATE TABLE "PredictionAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timeToFailure" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "isAccurate" BOOLEAN,
    "feedbackAt" TIMESTAMP(3),
    "feedbackBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PredictionAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelMetrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "auc" DOUBLE PRECISION NOT NULL,
    "trainingTime" INTEGER NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "features" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "metrics" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "TrainingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PredictionAlert_organizationId_createdAt_idx" ON "PredictionAlert"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ModelMetrics_organizationId_version_idx" ON "ModelMetrics"("organizationId", "version");

-- CreateIndex
CREATE INDEX "TrainingLog_organizationId_startedAt_idx" ON "TrainingLog"("organizationId", "startedAt");

-- AddForeignKey
ALTER TABLE "PredictionAlert" ADD CONSTRAINT "PredictionAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelMetrics" ADD CONSTRAINT "ModelMetrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLog" ADD CONSTRAINT "TrainingLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
