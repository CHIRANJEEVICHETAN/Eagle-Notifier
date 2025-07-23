-- CreateTable
CREATE TABLE "MLAuditLog" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "method" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestData" TEXT,
    "responseData" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "duration" INTEGER,
    "statusCode" INTEGER,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "MLAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pattern" TEXT,
    "request" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MLAuditLog_auditId_key" ON "MLAuditLog"("auditId");

-- CreateIndex
CREATE INDEX "MLAuditLog_organizationId_timestamp_idx" ON "MLAuditLog"("organizationId", "timestamp");

-- CreateIndex
CREATE INDEX "MLAuditLog_userId_timestamp_idx" ON "MLAuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "MLAuditLog_action_timestamp_idx" ON "MLAuditLog"("action", "timestamp");

-- CreateIndex
CREATE INDEX "MLAuditLog_status_idx" ON "MLAuditLog"("status");

-- CreateIndex
CREATE INDEX "SecurityIncident_organizationId_timestamp_idx" ON "SecurityIncident"("organizationId", "timestamp");

-- CreateIndex
CREATE INDEX "SecurityIncident_type_severity_idx" ON "SecurityIncident"("type", "severity");

-- CreateIndex
CREATE INDEX "SecurityIncident_resolved_idx" ON "SecurityIncident"("resolved");

-- CreateIndex
CREATE INDEX "SecurityIncident_severity_timestamp_idx" ON "SecurityIncident"("severity", "timestamp");

-- AddForeignKey
ALTER TABLE "MLAuditLog" ADD CONSTRAINT "MLAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
