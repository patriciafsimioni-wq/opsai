-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleNote" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleNote_vehicleId_createdAt_idx" ON "VehicleNote"("vehicleId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "VehicleNote" ADD CONSTRAINT "VehicleNote_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
