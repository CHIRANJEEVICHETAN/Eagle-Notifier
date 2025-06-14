-- CreateTable
CREATE TABLE "MeterLimit" (
    "id" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "highLimit" DOUBLE PRECISION NOT NULL,
    "lowLimit" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "MeterLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeterLimit_parameter_key" ON "MeterLimit"("parameter");
