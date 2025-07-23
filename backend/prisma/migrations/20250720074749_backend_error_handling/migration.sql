-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "errorName" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "stackTrace" TEXT,
    "context" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErrorLog_correlationId_key" ON "ErrorLog"("correlationId");

-- CreateIndex
CREATE INDEX "ErrorLog_organizationId_timestamp_idx" ON "ErrorLog"("organizationId", "timestamp");

-- CreateIndex
CREATE INDEX "ErrorLog_category_severity_idx" ON "ErrorLog"("category", "severity");

-- CreateIndex
CREATE INDEX "ErrorLog_correlationId_idx" ON "ErrorLog"("correlationId");

-- CreateIndex
CREATE INDEX "ErrorLog_resolved_idx" ON "ErrorLog"("resolved");
