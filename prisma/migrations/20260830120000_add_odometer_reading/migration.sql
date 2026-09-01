CREATE TABLE IF NOT EXISTS "OdometerReading" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "miles" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdometerReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OdometerReading_vehicleId_source_sourceId_key"
  ON "OdometerReading"("vehicleId", "source", "sourceId");

CREATE INDEX IF NOT EXISTS "OdometerReading_vehicleId_readAt_idx"
  ON "OdometerReading"("vehicleId", "readAt");

CREATE INDEX IF NOT EXISTS "OdometerReading_readAt_idx"
  ON "OdometerReading"("readAt");

ALTER TABLE "OdometerReading"
  DROP CONSTRAINT IF EXISTS "OdometerReading_vehicleId_fkey";

ALTER TABLE "OdometerReading"
  ADD CONSTRAINT "OdometerReading_vehicleId_fkey"
  FOREIGN KEY ("vehicleId")
  REFERENCES "Vehicle"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
