-- CreateTable
CREATE TABLE "PmBudget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "station" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PmBudget_year_month_station_category_key" ON "PmBudget"("year", "month", "station", "category");
