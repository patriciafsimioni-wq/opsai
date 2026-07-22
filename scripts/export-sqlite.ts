/**
 * Export all data from the current SQLite database to a JSON file.
 * Run: DATABASE_URL="file:./dev.db" npx tsx scripts/export-sqlite.ts
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

async function main() {
  console.log("Exporting data from SQLite...");

  const data: Record<string, unknown[]> = {};

  data.users = await prisma.user.findMany();
  data.drivers = await prisma.driver.findMany();
  data.vehicles = await prisma.vehicle.findMany();
  data.trips = await prisma.trip.findMany();
  data.workOrders = await prisma.workOrder.findMany();
  data.services = await prisma.service.findMany();
  data.maintenanceSchedules = await prisma.maintenanceSchedule.findMany();
  data.fuelLogs = await prisma.fuelLog.findMany();
  data.geofences = await prisma.geofence.findMany();
  data.alerts = await prisma.alert.findMany();
  data.telemetryLogs = await prisma.telemetryLog.findMany();
  data.pmBudgets = await prisma.pmBudget.findMany();
  data.fareyeRoutes = await prisma.fareyeRoute.findMany();
  data.workOrderRequests = await prisma.workOrderRequest.findMany();
  data.dvirReports = await prisma.dvirReport.findMany();

  // PmAlertDismissal may not exist yet
  try {
    data.pmAlertDismissals = await prisma.pmAlertDismissal.findMany();
  } catch {
    data.pmAlertDismissals = [];
  }

  for (const [key, rows] of Object.entries(data)) {
    console.log(`  ${key}: ${rows.length} rows`);
  }

  writeFileSync("/home/ubuntu/sqlite-export.json", JSON.stringify(data, null, 2));
  console.log("\nExported to /home/ubuntu/sqlite-export.json");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
