import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { TIME_SCHEDULE } from "@/lib/constants";

/**
 * Service intervals derived from the vehicle lifecycle PM schedule.
 * [interval in miles, service name, first occurrence mileage]
 */
const SERVICE_INTERVALS: [number, string, number][] = [
  [6000, "Oil + Filter + Tire Rotation", 6000],
  [10000, "Fluids", 10000],
  [12000, "Brake Pads Replacement", 20000],
  [12000, "Brake Inspection + Cabin Air", 24000],
  [30000, "Engine Air Filter", 30000],
  [30000, "Air Brake Cleaning", 30000],
  [40000, "Tire Replacement", 40000],
  [40000, "Brake Calipers", 40000],
  [50000, "Transmission Fluid", 50000],
  [50000, "Turbocharger Inspection", 50000],
  [80000, "Battery Replacement", 80000],
  [100000, "Coolant + Spark Plugs", 100000],
  [150000, "Timing Belt", 150000],
  [150000, "Diesel Filter Cleaning", 150000],
  [250000, "Drivetrain Overhaul", 250000],
];

const UPCOMING_WINDOW = 2000; // miles before due to flag as upcoming

/** Normalize a work order title into a canonical service name for matching. */
function matchService(woTitle: string): string | null {
  const lower = woTitle.toLowerCase();
  if (lower.includes("oil change") || lower.includes("oil + filter") || lower.includes("pm a") || lower.includes("pm b") || lower.includes("pm c") || lower.includes("tire rotation")) return "Oil + Filter + Tire Rotation";
  if (lower === "fluids" || lower === "fluids check" || lower.includes("fluids ")) return "Fluids";
  if (lower.includes("brake pad")) return "Brake Pads Replacement";
  if (lower.includes("brake inspection") || lower.includes("cabin air")) return "Brake Inspection + Cabin Air";
  if (lower.includes("engine air filter") || lower.includes("engine filter") || lower.includes("air filter")) return "Engine Air Filter";
  if (lower.includes("air brake") || lower.includes("purge brake")) return "Air Brake Cleaning";
  if (lower.includes("tire replacement") || lower.includes("tires replacement") || lower.includes("tire install")) return "Tire Replacement";
  if (lower.includes("brake caliper")) return "Brake Calipers";
  if (lower.includes("transmission")) return "Transmission Fluid";
  if (lower.includes("turbo")) return "Turbocharger Inspection";
  if (lower.includes("battery")) return "Battery Replacement";
  if (lower.includes("coolant") || lower.includes("spark plug")) return "Coolant + Spark Plugs";
  if (lower.includes("timing belt") || lower.includes("time belt")) return "Timing Belt";
  if (lower.includes("diesel filter")) return "Diesel Filter Cleaning";
  if (lower.includes("drivetrain")) return "Drivetrain Overhaul";
  if (lower.includes("wiper")) return "Wiper Blades";
  return null;
}

type ServiceStatus = {
  service: string;
  interval: number;
  firstDue: number;
  lastPerformedAt: number | null;
  lastPerformedDate: string | null;
  nextDue: number;
  milesUntil: number;
  status: "overdue" | "upcoming" | "on_track" | "never_performed";
};

type TimeServiceStatus = {
  service: string;
  intervalMonths: number;
  lastPerformedDate: string | null;
  nextDueDate: string | null;
  daysUntil: number | null;
  status: "overdue" | "upcoming" | "on_track" | "never_performed";
};

type VehicleSchedule = {
  id: string;
  name: string;
  dxNumber: string | null;
  station: string;
  odometer: number;
  type: string;
  year: number;
  make: string;
  model: string;
  onboardedDate: string | null;
  overdueCount: number;
  upcomingCount: number;
  neverPerformedCount: number;
  alertCount: number;
  nextService: ServiceStatus | null;
  mileageServices: ServiceStatus[];
  timeServices: TimeServiceStatus[];
};

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const stationFilter = url.searchParams.get("station") ?? "ALL";

  const vehicles = await prisma.vehicle.findMany({
    where: stationFilter !== "ALL" ? { station: stationFilter as never } : undefined,
    select: {
      id: true,
      name: true,
      dxNumber: true,
      station: true,
      odometer: true,
      type: true,
      year: true,
      make: true,
      model: true,
      onboardedDate: true,
      status: true,
    },
    orderBy: { station: "asc" },
  });

  // Get all completed work orders with odometerAt
  const completedWOs = await prisma.workOrder.findMany({
    where: { status: "COMPLETED" },
    select: { vehicleId: true, title: true, completedAt: true, odometerAt: true },
    orderBy: { completedAt: "desc" },
  });

  // Group by vehicle
  const woByVehicle: Record<string, { title: string; completedAt: Date | null; odometerAt: number | null }[]> = {};
  for (const wo of completedWOs) {
    if (!woByVehicle[wo.vehicleId]) woByVehicle[wo.vehicleId] = [];
    woByVehicle[wo.vehicleId].push(wo);
  }

  const now = new Date();

  const schedules: VehicleSchedule[] = vehicles
    .filter((v) => v.status === "ACTIVE" || v.status === "MAINTENANCE")
    .map((v) => {
      const odo = v.odometer;
      const vehicleWOs = woByVehicle[v.id] ?? [];

      // For each service type, find the LAST completed WO matching that service
      const lastPerformed: Record<string, { odometerAt: number; completedAt: Date }> = {};
      for (const wo of vehicleWOs) {
        const serviceName = matchService(wo.title);
        if (!serviceName) continue;
        if (!lastPerformed[serviceName] && wo.odometerAt != null && wo.completedAt) {
          lastPerformed[serviceName] = { odometerAt: wo.odometerAt, completedAt: wo.completedAt };
        }
      }

      // Compute status for each mileage-based service
      const mileageServices: ServiceStatus[] = SERVICE_INTERVALS.map(([interval, service, firstDue]) => {
        const last = lastPerformed[service];

        let nextDue: number;
        let lastPerformedAt: number | null = null;
        let lastPerformedDate: string | null = null;
        let status: ServiceStatus["status"];

        if (last) {
          // Service was performed before: next due = last performed mileage + interval
          lastPerformedAt = Math.round(last.odometerAt);
          lastPerformedDate = last.completedAt.toISOString().slice(0, 10);
          nextDue = lastPerformedAt + interval;
        } else {
          // Never performed: next due = first occurrence in schedule
          nextDue = firstDue;
        }

        const milesUntil = Math.round(nextDue - odo);

        if (!last && odo >= firstDue) {
          // Should have had this service by now but never did
          status = "never_performed";
        } else if (milesUntil < 0) {
          status = "overdue";
        } else if (milesUntil <= UPCOMING_WINDOW) {
          status = "upcoming";
        } else {
          status = "on_track";
        }

        return {
          service,
          interval,
          firstDue,
          lastPerformedAt,
          lastPerformedDate,
          nextDue: Math.round(nextDue),
          milesUntil,
          status,
        };
      });

      // Time-based services (Wiper Blades = every 12 months)
      const onboarded = v.onboardedDate ? new Date(v.onboardedDate) : null;
      const timeServices: TimeServiceStatus[] = TIME_SCHEDULE.map(([intervalMonths, service]) => {
        const lastWiper = lastPerformed[service];

        let lastPerformedDate: string | null = null;
        let nextDueDate: string | null = null;
        let daysUntil: number | null = null;
        let status: TimeServiceStatus["status"];

        if (lastWiper) {
          lastPerformedDate = lastWiper.completedAt.toISOString().slice(0, 10);
          const nextDue = new Date(lastWiper.completedAt);
          nextDue.setMonth(nextDue.getMonth() + intervalMonths);
          nextDueDate = nextDue.toISOString().slice(0, 10);
          daysUntil = Math.round((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          status = daysUntil < 0 ? "overdue" : daysUntil <= 30 ? "upcoming" : "on_track";
        } else if (onboarded) {
          // Never performed — check if overdue based on onboarded date
          const monthsSinceOnboard = (now.getFullYear() - onboarded.getFullYear()) * 12 + (now.getMonth() - onboarded.getMonth());
          if (monthsSinceOnboard >= intervalMonths) {
            // Should have been done by now
            const shouldHaveDone = new Date(onboarded);
            shouldHaveDone.setMonth(shouldHaveDone.getMonth() + intervalMonths);
            nextDueDate = shouldHaveDone.toISOString().slice(0, 10);
            daysUntil = Math.round((shouldHaveDone.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            status = "never_performed";
          } else {
            const nextDue = new Date(onboarded);
            nextDue.setMonth(nextDue.getMonth() + intervalMonths);
            nextDueDate = nextDue.toISOString().slice(0, 10);
            daysUntil = Math.round((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            status = daysUntil <= 30 ? "upcoming" : "on_track";
          }
        } else {
          status = "on_track";
        }

        return { service, intervalMonths, lastPerformedDate, nextDueDate, daysUntil, status };
      });

      const overdueCount = mileageServices.filter((s) => s.status === "overdue").length + timeServices.filter((s) => s.status === "overdue").length;
      const upcomingCount = mileageServices.filter((s) => s.status === "upcoming").length + timeServices.filter((s) => s.status === "upcoming").length;
      const neverPerformedCount = mileageServices.filter((s) => s.status === "never_performed").length + timeServices.filter((s) => s.status === "never_performed").length;
      const alertCount = overdueCount + neverPerformedCount;

      // Next service = first overdue or never_performed, then first upcoming
      const nextService =
        mileageServices.find((s) => s.status === "never_performed") ??
        mileageServices.find((s) => s.status === "overdue") ??
        mileageServices.find((s) => s.status === "upcoming") ??
        null;

      return {
        id: v.id,
        name: v.name,
        dxNumber: v.dxNumber,
        station: v.station,
        odometer: Math.round(odo),
        type: v.type,
        year: v.year,
        make: v.make,
        model: v.model,
        onboardedDate: v.onboardedDate?.toISOString().slice(0, 10) ?? null,
        overdueCount,
        upcomingCount,
        neverPerformedCount,
        alertCount,
        nextService,
        mileageServices,
        timeServices,
      };
    });

  // Sort: alerts first (never_performed + overdue), then upcoming, then by station
  schedules.sort((a, b) => {
    if (a.alertCount !== b.alertCount) return b.alertCount - a.alertCount;
    if (a.upcomingCount !== b.upcomingCount) return b.upcomingCount - a.upcomingCount;
    return a.station.localeCompare(b.station);
  });

  const totalVehicles = schedules.length;
  const vehiclesWithAlerts = schedules.filter((s) => s.alertCount > 0).length;
  const vehiclesOverdue = schedules.filter((s) => s.overdueCount > 0).length;
  const vehiclesUpcoming = schedules.filter((s) => s.upcomingCount > 0).length;
  const vehiclesNeverPerformed = schedules.filter((s) => s.neverPerformedCount > 0).length;
  const totalAlerts = schedules.reduce((s, v) => s + v.alertCount, 0);
  const totalOverdueServices = schedules.reduce((s, v) => s + v.overdueCount, 0);
  const totalUpcomingServices = schedules.reduce((s, v) => s + v.upcomingCount, 0);
  const totalNeverPerformed = schedules.reduce((s, v) => s + v.neverPerformedCount, 0);

  return NextResponse.json({
    totalVehicles,
    vehiclesWithAlerts,
    vehiclesOverdue,
    vehiclesUpcoming,
    vehiclesNeverPerformed,
    totalAlerts,
    totalOverdueServices,
    totalUpcomingServices,
    totalNeverPerformed,
    vehicles: schedules,
  });
}
