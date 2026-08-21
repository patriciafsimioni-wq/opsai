-- CreateTable
CREATE TABLE "FareyeRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "routeId" TEXT NOT NULL,
    "miles" REAL NOT NULL,
    "travelMinutes" INTEGER NOT NULL,
    "routeDurationMinutes" INTEGER NOT NULL,
    "leaveByTime" TEXT,
    "plannedEndTime" TEXT,
    "stops" INTEGER NOT NULL,
    "totalWeight" REAL NOT NULL DEFAULT 0,
    "totalPallets" INTEGER NOT NULL DEFAULT 0,
    "vehicleType" TEXT NOT NULL,
    "vehicleTag" TEXT,
    "vehicleUtilization" REAL NOT NULL,
    "sporh" REAL NOT NULL,
    "plannedHours" REAL NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "station" TEXT NOT NULL DEFAULT 'IAH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "FareyeRoute_date_idx" ON "FareyeRoute"("date");

-- CreateIndex
CREATE INDEX "FareyeRoute_station_idx" ON "FareyeRoute"("station");
