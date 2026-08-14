-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FuelLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liters" REAL NOT NULL,
    "pricePerLiter" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "odometer" REAL,
    "location" TEXT,
    "purchaseType" TEXT NOT NULL DEFAULT 'DIESEL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FuelLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FuelLog" ("createdAt", "date", "driverId", "id", "liters", "location", "odometer", "pricePerLiter", "totalCost", "vehicleId") SELECT "createdAt", "date", "driverId", "id", "liters", "location", "odometer", "pricePerLiter", "totalCost", "vehicleId" FROM "FuelLog";
DROP TABLE "FuelLog";
ALTER TABLE "new_FuelLog" RENAME TO "FuelLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
