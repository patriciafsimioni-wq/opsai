CREATE TABLE IF NOT EXISTS "DvirRepair" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedAt" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT,
    "invoiceNumber" TEXT,
    "photos" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DvirRepair_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DvirRepair_reportId_item_key" ON "DvirRepair"("reportId", "item");
CREATE INDEX IF NOT EXISTS "DvirRepair_reportId_idx" ON "DvirRepair"("reportId");

ALTER TABLE "DvirRepair" DROP CONSTRAINT IF EXISTS "DvirRepair_reportId_fkey";
ALTER TABLE "DvirRepair" ADD CONSTRAINT "DvirRepair_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DvirReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DvirRepair" DROP CONSTRAINT IF EXISTS "DvirRepair_recordedById_fkey";
ALTER TABLE "DvirRepair" ADD CONSTRAINT "DvirRepair_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
