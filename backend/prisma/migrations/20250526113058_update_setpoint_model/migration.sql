-- CreateTable
CREATE TABLE "Setpoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "zone" TEXT,
    "scadaField" TEXT NOT NULL,
    "lowDeviation" DOUBLE PRECISION NOT NULL,
    "highDeviation" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setpoint_pkey" PRIMARY KEY ("id")
);
