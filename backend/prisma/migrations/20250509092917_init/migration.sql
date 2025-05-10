-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AlarmType" AS ENUM ('TEMPERATURE', 'LEVEL', 'PRESSURE', 'MOTOR', 'CONVEYOR', 'FAN', 'HEATER', 'CARBON', 'OIL');

-- CreateEnum
CREATE TYPE "Zone" AS ENUM ('ZONE1', 'ZONE2');

-- CreateEnum
CREATE TYPE "AlarmSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "AlarmStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ALARM', 'SYSTEM', 'MAINTENANCE', 'INFO');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pushToken" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedAlarmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "criticalOnly" BOOLEAN NOT NULL DEFAULT false,
    "muteFrom" INTEGER,
    "muteTo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "AlarmType" NOT NULL,
    "zone" "Zone",
    "severity" "AlarmSeverity" NOT NULL,
    "status" "AlarmStatus" NOT NULL DEFAULT 'ACTIVE',
    "value" TEXT NOT NULL,
    "setPoint" TEXT NOT NULL,
    "unit" TEXT,
    "lowLimit" DOUBLE PRECISION,
    "highLimit" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlarmHistory" (
    "id" TEXT NOT NULL,
    "alarmId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "AlarmType" NOT NULL,
    "severity" "AlarmSeverity" NOT NULL,
    "status" "AlarmStatus" NOT NULL,
    "value" TEXT NOT NULL,
    "setPoint" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AlarmHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relatedAlarmId_fkey" FOREIGN KEY ("relatedAlarmId") REFERENCES "Alarm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlarmHistory" ADD CONSTRAINT "AlarmHistory_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "Alarm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
