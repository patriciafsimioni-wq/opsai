import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Gauge,
  Fuel,
  Calendar,
  ShieldCheck,
  MapPin,
  User,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, Table, Th, Td, ProgressBar } from "@/components/ui";
import { VehicleActions } from "@/components/VehicleActions";
import { VehicleEditForm } from "@/components/VehicleEditForm";
import {
  VEHICLE_STATUS,
  LIFECYCLE_STATUS,
  WO_STATUS,
  PRIORITY,
  TIME_SCHEDULE,
  titleCase,
} from "@/lib/constants";
import {
  formatNumber,
  formatDate,
  formatCurrency,
  relativeTime,
  daysUntil,
} from "@/lib/utils";

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

function matchService(woTitle: string): string | null {
  const lower = woTitle.toLowerCase();
  if (lower.includes("oil change") || lower.includes("oil + filter") || lower.includes("pm a") || lower.includes("pm b") || lower.includes("pm c") || lower.includes("tire rotation") || lower.includes("oil filter")) return "Oil + Filter + Tire Rotation";
  if (lower.includes("fluid") && !lower.includes("transmission")) return "Fluids";
  if (lower.includes("brake pad") || lower.includes("brake pads")) return "Brake Pads Replacement";
  if (lower.includes("brake inspection") || lower.includes("cabin air") || lower.includes("brake rotor")) return "Brake Inspection + Cabin Air";
  if (lower.includes("engine air filter") || lower.includes("engine filter")) return "Engine Air Filter";
  if (lower.includes("air brake") || lower.includes("purge brake")) return "Air Brake Cleaning";
  if (lower.includes("tire replacement") || lower.includes("tires replacement") || lower.includes("tire install") || lower.includes("new tires")) return "Tire Replacement";
  if (lower.includes("brake caliper")) return "Brake Calipers";
  if (lower.includes("transmission")) return "Transmission Fluid";
  if (lower.includes("turbo") || lower.includes("actuator")) return "Turbocharger Inspection";
  if (lower.includes("battery") && !lower.includes("terminal")) return "Battery Replacement";
  if (lower.includes("coolant") || lower.includes("spark plug") || lower.includes("radiator") || lower.includes("cooling system")) return "Coolant + Spark Plugs";
  if (lower.includes("timing belt") || lower.includes("time belt")) return "Timing Belt";
  if (lower.includes("diesel filter")) return "Diesel Filter Cleaning";
  if (lower.includes("drivetrain")) return "Drivetrain Overhaul";
  if (lower.includes("wiper")) return "Wiper Blades";
  return null;
}

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      assignedDriver: true,
      maintenance: { orderBy: { createdAt: "desc" } },
      fuelLogs: { orderBy: { date: "desc" } },
      trips: { orderBy: { scheduledStart: "desc" }, take: 8, include: { driver: true } },
    },
  });
  if (!v) notFound();

  const status = VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS];
  const lifecycle = LIFECYCLE_STATUS[(v.lifecycleStatus ?? "ACTIVE") as keyof typeof LIFECYCLE_STATUS] ?? LIFECYCLE_STATUS.ACTIVE;
  const totalFuelCost = v.fuelLogs.reduce((s, f) => s + f.totalCost, 0);
  const totalMaintCost = v.maintenance
    .filter((w) => w.status === "COMPLETED")
    .reduce((s, w) => s + w.cost, 0);
  const totalMaterialCost = v.maintenance.filter((w) => w.status === "COMPLETED").reduce((s, w) => s + w.materialCost, 0);
  const totalLaborCost = v.maintenance.filter((w) => w.status === "COMPLETED").reduce((s, w) => s + w.laborCost, 0);

  const now = new Date();

  // Initial Investment
  const initialInvestment = (v.purchasePrice ?? 0) + (v.taxesAndFees ?? 0) + (v.brandingCost ?? 0) + (v.gpsCamerasCost ?? 0) + (v.upfittingCost ?? 0) + (v.registrationCost ?? 0) + (v.initialInsurance ?? 0);

  // Lease payments to date
  const leaseMonthsPaid = v.leaseStartDate
    ? Math.max(0, Math.round((new Date().getTime() - new Date(v.leaseStartDate).getTime()) / (30 * 86400000)))
    : 0;
  const totalLeasePaid = (v.monthlyPayment ?? v.totalRentPerMonth ?? 0) * leaseMonthsPaid;

  // Total lifetime cost
  const totalLifetimeCost = initialInvestment + totalMaintCost + totalFuelCost + totalLeasePaid;

  // Cost metrics — use best available start date for days in service
  const serviceStartDate = v.onboardedDate ?? v.leaseStartDate ?? (v.monthsInService ? new Date(now.getTime() - v.monthsInService * 30 * 86400000) : new Date(v.year, 0, 1));
  const daysInService = Math.max(1, Math.round((now.getTime() - new Date(serviceStartDate).getTime()) / 86400000));
  const costPerMile = v.odometer > 0 ? totalLifetimeCost / v.odometer : null;
  const costPerDay = totalLifetimeCost / daysInService;

  // Replacement Score (0-100)
  const ageYears = now.getFullYear() - (v.year ?? now.getFullYear());
  const maxAge = v.type === "VAN" ? 4 : 7;
  const ageScore = Math.min(100, (ageYears / maxAge) * 100);
  const mileageScore = v.odometer > 0 ? Math.min(100, (v.odometer / 250000) * 100) : Math.min(100, (ageYears * 25000 / 250000) * 100);
  const breakdownCount = v.maintenance.filter((w) => w.type === "REPAIR" && w.status === "COMPLETED").length;
  const breakdownScore = Math.min(100, breakdownCount * 10);
  const estimatedCPM = costPerMile ?? (totalLifetimeCost > 0 && ageYears > 0 ? totalLifetimeCost / (ageYears * 25000) : 0);
  const costTrend = estimatedCPM > 1.5 ? 100 : estimatedCPM > 1.0 ? 70 : estimatedCPM > 0.5 ? 40 : 20;
  const replacementScore = Math.round(100 - (ageScore * 0.3 + mileageScore * 0.25 + breakdownScore * 0.25 + costTrend * 0.2));
  const healthGrade = replacementScore >= 70 ? "HEALTHY" : replacementScore >= 50 ? "MONITOR" : replacementScore >= 30 ? "PLAN_REPLACEMENT" : "REPLACE_NOW";
  const regDays = daysUntil(v.registrationExpiry);
  const insDays = daysUntil(v.insuranceExpiry);

  // Build odometer estimation from known data points
  // Collect all WOs with known odometer + date, plus current odometer
  const knownOdoPoints: { date: number; odo: number }[] = [];
  for (const wo of v.maintenance) {
    if (wo.odometerAt && wo.odometerAt > 0 && wo.completedAt) {
      knownOdoPoints.push({ date: new Date(wo.completedAt).getTime(), odo: wo.odometerAt });
    }
  }
  // Add current odometer as latest data point
  if (v.odometer > 0) {
    knownOdoPoints.push({ date: now.getTime(), odo: v.odometer });
  }
  // Sort by date ascending
  knownOdoPoints.sort((a, b) => a.date - b.date);

  // Fallback: estimate average daily miles from vehicle year and current odo
  const vehicleStartMs = new Date(v.year, 0, 1).getTime();
  const avgDailyMiles = v.odometer > 0
    ? v.odometer / Math.max(1, (now.getTime() - vehicleStartMs) / 86400000)
    : 70; // default ~25k miles/year

  function estimateOdoAtDate(dateMs: number): number | null {
    if (knownOdoPoints.length >= 2) {
      // If before earliest point, extrapolate using first two points' rate
      if (dateMs <= knownOdoPoints[0].date) {
        const rate = (knownOdoPoints[1].odo - knownOdoPoints[0].odo) / (knownOdoPoints[1].date - knownOdoPoints[0].date);
        return Math.max(0, Math.round(knownOdoPoints[0].odo + rate * (dateMs - knownOdoPoints[0].date)));
      }
      // If after latest point, extrapolate
      if (dateMs >= knownOdoPoints[knownOdoPoints.length - 1].date) {
        const last = knownOdoPoints[knownOdoPoints.length - 1];
        const prev = knownOdoPoints[knownOdoPoints.length - 2];
        const rate = (last.odo - prev.odo) / (last.date - prev.date);
        return Math.round(last.odo + rate * (dateMs - last.date));
      }
      // Interpolate between two closest points
      for (let i = 0; i < knownOdoPoints.length - 1; i++) {
        if (dateMs >= knownOdoPoints[i].date && dateMs <= knownOdoPoints[i + 1].date) {
          const ratio = (dateMs - knownOdoPoints[i].date) / (knownOdoPoints[i + 1].date - knownOdoPoints[i].date);
          return Math.round(knownOdoPoints[i].odo + ratio * (knownOdoPoints[i + 1].odo - knownOdoPoints[i].odo));
        }
      }
    }
    // Fallback: use average daily mileage from vehicle age
    const currentOdo = v!.odometer;
    if (currentOdo > 0) {
      const daysDiff = (now.getTime() - dateMs) / 86400000;
      return Math.max(0, Math.round(currentOdo - avgDailyMiles * daysDiff));
    }
    return null;
  }

  // Compute maintenance schedule for this vehicle
  const completedWOs = v.maintenance.filter((w) => w.status === "COMPLETED");
  const lastPerformed: Record<string, { odometerAt: number; completedAt: Date; estimated?: boolean }> = {};
  for (const wo of completedWOs) {
    const svcName = matchService(wo.title);
    if (!svcName) continue;
    if (!lastPerformed[svcName] && wo.completedAt) {
      if (wo.odometerAt != null && wo.odometerAt > 0) {
        lastPerformed[svcName] = { odometerAt: wo.odometerAt, completedAt: wo.completedAt };
      } else {
        // Estimate odometer from service date
        const est = estimateOdoAtDate(new Date(wo.completedAt).getTime());
        if (est !== null) {
          lastPerformed[svcName] = { odometerAt: est, completedAt: wo.completedAt, estimated: true };
        }
      }
    }
  }
  const odo = v.odometer;
  const scheduleRows = SERVICE_INTERVALS.map(([interval, service, firstDue]) => {
    const last = lastPerformed[service];
    let nextDue: number;
    let lastAt: number | null = null;
    let lastDate: string | null = null;
    let svcStatus: "never_performed" | "overdue" | "upcoming" | "on_track";
    if (last) {
      lastAt = Math.round(last.odometerAt);
      lastDate = last.completedAt.toISOString().slice(0, 10);
      nextDue = lastAt + interval;
    } else {
      // Never done: show the NEXT upcoming due (most recent interval point past current odo + interval)
      const periodsPassed = Math.floor((odo - firstDue) / interval);
      nextDue = firstDue + Math.max(0, periodsPassed + 1) * interval;
    }
    const milesUntil = Math.round(nextDue - odo);
    if (!last && odo >= firstDue) svcStatus = "never_performed";
    else if (milesUntil < 0) svcStatus = "overdue";
    else if (milesUntil <= 2000) svcStatus = "upcoming";
    else svcStatus = "on_track";
    return { service, interval, lastAt, lastDate, nextDue: Math.round(nextDue), milesUntil, status: svcStatus };
  });
  // Time-based
  const timeRows = TIME_SCHEDULE.map(([intervalMonths, service]) => {
    const last = lastPerformed[service];
    let lastDate: string | null = null;
    let nextDueDate: string | null = null;
    let daysTil: number | null = null;
    let tStatus: "never_performed" | "overdue" | "upcoming" | "on_track";
    if (last) {
      lastDate = last.completedAt.toISOString().slice(0, 10);
      const nd = new Date(last.completedAt);
      nd.setMonth(nd.getMonth() + intervalMonths);
      nextDueDate = nd.toISOString().slice(0, 10);
      daysTil = Math.round((nd.getTime() - now.getTime()) / 86400000);
      tStatus = daysTil < 0 ? "overdue" : daysTil <= 30 ? "upcoming" : "on_track";
    } else if (v.onboardedDate) {
      const months = (now.getFullYear() - v.onboardedDate.getFullYear()) * 12 + (now.getMonth() - v.onboardedDate.getMonth());
      if (months >= intervalMonths) {
        tStatus = "never_performed";
        const sd = new Date(v.onboardedDate);
        sd.setMonth(sd.getMonth() + intervalMonths);
        nextDueDate = sd.toISOString().slice(0, 10);
        daysTil = Math.round((sd.getTime() - now.getTime()) / 86400000);
      } else {
        const nd = new Date(v.onboardedDate);
        nd.setMonth(nd.getMonth() + intervalMonths);
        nextDueDate = nd.toISOString().slice(0, 10);
        daysTil = Math.round((nd.getTime() - now.getTime()) / 86400000);
        tStatus = daysTil <= 30 ? "upcoming" : "on_track";
      }
    } else {
      tStatus = "on_track";
    }
    return { service, intervalMonths, lastDate, nextDueDate, daysTil, status: tStatus };
  });
  const alertRows = scheduleRows.filter((r) => r.status === "never_performed" || r.status === "overdue");
  const upcomingRows = scheduleRows.filter((r) => r.status === "upcoming");
  const timeAlerts = timeRows.filter((r) => r.status === "never_performed" || r.status === "overdue");

  return (
    <div>
      <Link
        href="/vehicles"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back to vehicles
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{v.name}</h1>
            <Badge bg={status.bg} fg={status.fg}>
              {status.label}
            </Badge>
            <Badge bg={lifecycle.bg} fg={lifecycle.fg}>
              {lifecycle.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {v.year} {v.make} {v.model} · {titleCase(v.type)} · {v.licensePlate}
            {v.dxNumber ? ` · ${v.dxNumber}` : ""}
          </p>
        </div>
        <VehicleEditForm
          vehicle={{
            id: v.id,
            name: v.name,
            dxNumber: v.dxNumber,
            make: v.make,
            model: v.model,
            year: v.year,
            vin: v.vin,
            licensePlate: v.licensePlate,
            type: v.type,
            station: v.station,
            fuelType: v.fuelType,
            odometer: v.odometer,
            tankCapacity: v.tankCapacity,
            leasingCompany: v.leasingCompany,
            leaseEndDate: v.leaseEndDate?.toISOString().slice(0, 10) ?? null,
            registrationMonth: v.registrationMonth,
            lifecycleStatus: v.lifecycleStatus ?? "ACTIVE",
            purchasePrice: v.purchasePrice,
            taxesAndFees: v.taxesAndFees,
            brandingCost: v.brandingCost,
            gpsCamerasCost: v.gpsCamerasCost,
            upfittingCost: v.upfittingCost,
            registrationCost: v.registrationCost,
            initialInsurance: v.initialInsurance,
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Gauge size={14} /> Odometer
          </div>
          <p className="mt-1 text-xl font-bold">{formatNumber(v.odometer)} mi</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Fuel size={14} /> Fuel Level
          </div>
          <p className="mt-1 text-xl font-bold">{Math.round(v.fuelLevel)}%</p>
          <div className="mt-2">
            <ProgressBar value={v.fuelLevel} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin size={14} /> Last Seen
          </div>
          <p className="mt-1 text-xl font-bold">{relativeTime(v.lastSeen)}</p>
          <p className="text-xs text-slate-400">
            {v.lat?.toFixed(4)}, {v.lng?.toFixed(4)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <User size={14} /> Driver
          </div>
          <p className="mt-1 text-lg font-bold">
            {v.assignedDriver
              ? `${v.assignedDriver.firstName} ${v.assignedDriver.lastName}`
              : "Unassigned"}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Specifications" />
          <dl className="divide-y divide-[var(--color-border)] text-sm">
            {([
              ["VIN", v.vin],
              ["DX #", v.dxNumber ?? "—"],
              ["Fuel type", titleCase(v.fuelType)],
              ["Tank capacity", `${v.tankCapacity} L`],
              ["Leasing Company", v.leasingCompany ?? "—"],
              ["Samsara ID", v.samsaraId ?? "—"],
              ["Onboarded", v.onboardedDate ? formatDate(v.onboardedDate) : "—"],
              ["Lease End", v.leaseEndDate ? formatDate(v.leaseEndDate) : "—"],
              ["Registration Month", v.registrationMonth ?? "—"],
            ] as [string, string][]).map(([k, val]) => (
              <div key={k} className="flex justify-between px-5 py-2.5">
                <dt className="text-slate-400">{k}</dt>
                <dd className="font-medium">{val}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Compliance" subtitle="Document status" />
          <div className="space-y-3 p-5">
            <ComplianceRow
              label="Registration"
              date={v.registrationExpiry}
              days={regDays}
            />
            <ComplianceRow
              label="Insurance"
              date={v.insuranceExpiry}
              days={insDays}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Fleet Health Score" />
          <div className="p-5 text-center">
            <div className={`inline-flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold ${
              healthGrade === "HEALTHY" ? "bg-green-100 text-green-700"
              : healthGrade === "MONITOR" ? "bg-yellow-100 text-yellow-700"
              : healthGrade === "PLAN_REPLACEMENT" ? "bg-orange-100 text-orange-700"
              : "bg-red-100 text-red-700"
            }`}>
              {replacementScore}
            </div>
            <p className={`mt-2 text-sm font-semibold ${
              healthGrade === "HEALTHY" ? "text-green-600"
              : healthGrade === "MONITOR" ? "text-yellow-600"
              : healthGrade === "PLAN_REPLACEMENT" ? "text-orange-600"
              : "text-red-600"
            }`}>
              {healthGrade === "HEALTHY" ? "Healthy" : healthGrade === "MONITOR" ? "Monitor" : healthGrade === "PLAN_REPLACEMENT" ? "Plan Replacement" : "Replace Now"}
            </p>
            <div className="mt-3 space-y-1 text-left text-xs text-slate-500">
              <div className="flex justify-between"><span>Cost/Mile</span><span className="font-medium text-slate-700">{costPerMile != null ? formatCurrency(costPerMile) : "N/A"}</span></div>
              <div className="flex justify-between"><span>Cost/Day</span><span className="font-medium text-slate-700">{formatCurrency(costPerDay)}</span></div>
            </div>
          </div>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="mt-6">
        <Card>
          <CardHeader title="Financial Summary" subtitle="Total Cost of Ownership" />
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Total Invested</p>
                <p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(totalLifetimeCost)}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-blue-600">Initial Investment</p>
                <p className="mt-1 text-xl font-bold text-blue-800">{formatCurrency(initialInvestment)}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-amber-600">Maintenance</p>
                <p className="mt-1 text-xl font-bold text-amber-800">{formatCurrency(totalMaintCost)}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-green-600">Fuel</p>
                <p className="mt-1 text-xl font-bold text-green-800">{formatCurrency(totalFuelCost)}</p>
              </div>
            </div>

            {initialInvestment > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Initial Investment Breakdown</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-xs">
                  {v.purchasePrice ? <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Purchase Price</span><span className="font-medium">{formatCurrency(v.purchasePrice)}</span></div> : null}
                  {v.taxesAndFees ? <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Taxes & Fees</span><span className="font-medium">{formatCurrency(v.taxesAndFees)}</span></div> : null}
                  {v.brandingCost ? <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Branding</span><span className="font-medium">{formatCurrency(v.brandingCost)}</span></div> : null}
                  {v.gpsCamerasCost ? <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">GPS & Cameras</span><span className="font-medium">{formatCurrency(v.gpsCamerasCost)}</span></div> : null}
                  {v.upfittingCost ? <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Upfitting</span><span className="font-medium">{formatCurrency(v.upfittingCost)}</span></div> : null}
                  {v.registrationCost ? <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Registration</span><span className="font-medium">{formatCurrency(v.registrationCost)}</span></div> : null}
                  {v.initialInsurance ? <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Initial Insurance</span><span className="font-medium">{formatCurrency(v.initialInsurance)}</span></div> : null}
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Lifetime Cost Breakdown</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Maintenance</span><span className="font-medium">{formatCurrency(totalMaintCost)}</span></div>
                {totalMaterialCost > 0 && <div className="flex justify-between border-b border-slate-100 pb-1 pl-4"><span className="text-slate-400">Parts</span><span className="text-slate-500">{formatCurrency(totalMaterialCost)}</span></div>}
                {totalLaborCost > 0 && <div className="flex justify-between border-b border-slate-100 pb-1 pl-4"><span className="text-slate-400">Labor</span><span className="text-slate-500">{formatCurrency(totalLaborCost)}</span></div>}
                <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Fuel ({v.fuelLogs.length} fills)</span><span className="font-medium">{formatCurrency(totalFuelCost)}</span></div>
                {totalLeasePaid > 0 && <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">Leasing</span><span className="font-medium">{formatCurrency(totalLeasePaid)}</span></div>}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Vehicle Management — Offboard / Onboard / Branding */}
      <VehicleActions
        vehicleId={v.id}
        branding={v.branding}
        offboardedDate={v.offboardedDate?.toISOString() ?? null}
        offboardReason={v.offboardReason}
        onboardedDate={v.onboardedDate?.toISOString() ?? null}
        onboardPhotos={v.onboardPhotos}
        status={v.status}
      />

      {/* Lease & Financial Section */}
      {v.leasingCompany && (
        <div className="mt-6">
          <Card>
            <CardHeader title="Lease & Financial" subtitle={v.leasingCompany} />
            <div className="p-5">
              {v.paidOff ? (
                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                  <p className="text-sm font-semibold text-green-700">✓ Vehicle Paid Off</p>
                  <p className="text-xs text-green-600 mt-0.5">No remaining lease payments</p>
                </div>
              ) : (
                <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-700">Active Lease — {v.monthsLeftPayoff ?? "?"} months remaining</p>
                  {v.leaseEndDate && <p className="text-xs text-blue-600 mt-0.5">Lease ends {formatDate(v.leaseEndDate)}</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {v.leaseType && (
                  <div>
                    <p className="text-xs text-slate-400">Lease Type</p>
                    <p className="text-sm font-medium">{v.leaseType}</p>
                  </div>
                )}
                {v.leaseTerm && (
                  <div>
                    <p className="text-xs text-slate-400">Term</p>
                    <p className="text-sm font-medium">{v.leaseTerm} months</p>
                  </div>
                )}
                {v.monthsInService && (
                  <div>
                    <p className="text-xs text-slate-400">Months in Service</p>
                    <p className="text-sm font-medium">{v.monthsInService}</p>
                  </div>
                )}
                {v.contractMileage && (
                  <div>
                    <p className="text-xs text-slate-400">Contract Mileage</p>
                    <p className="text-sm font-medium">{formatNumber(v.contractMileage)} mi</p>
                  </div>
                )}
                {v.deliveredPrice && (
                  <div>
                    <p className="text-xs text-slate-400">Delivered Price</p>
                    <p className="text-sm font-medium">{formatCurrency(v.deliveredPrice)}</p>
                  </div>
                )}
                {v.totalRentPerMonth && (
                  <div>
                    <p className="text-xs text-slate-400">Total Rent/Month</p>
                    <p className="text-sm font-medium">{formatCurrency(v.totalRentPerMonth)}</p>
                  </div>
                )}
                {v.leaseChargePerMonth && (
                  <div>
                    <p className="text-xs text-slate-400">Lease Charge/Month</p>
                    <p className="text-sm font-medium">{formatCurrency(v.leaseChargePerMonth)}</p>
                  </div>
                )}
                {v.depAmtPerMonth && (
                  <div>
                    <p className="text-xs text-slate-400">Depreciation/Month</p>
                    <p className="text-sm font-medium">{formatCurrency(v.depAmtPerMonth)}</p>
                  </div>
                )}
                {v.serviceChargePerMonth && (
                  <div>
                    <p className="text-xs text-slate-400">Service Charge/Month</p>
                    <p className="text-sm font-medium">{formatCurrency(v.serviceChargePerMonth)}</p>
                  </div>
                )}
                {v.currentBookValue && (
                  <div>
                    <p className="text-xs text-slate-400">Current Book Value</p>
                    <p className="text-sm font-medium">{formatCurrency(v.currentBookValue)}</p>
                  </div>
                )}
                {v.openEndNetBookValue && (
                  <div>
                    <p className="text-xs text-slate-400">Net Book Value</p>
                    <p className="text-sm font-medium">{formatCurrency(v.openEndNetBookValue)}</p>
                  </div>
                )}
                {v.currentMarketValue && (
                  <div>
                    <p className="text-xs text-slate-400">Current Market Value</p>
                    <p className="text-sm font-medium">{formatCurrency(v.currentMarketValue)}</p>
                  </div>
                )}
                {v.excessMileageRate != null && v.excessMileageRate > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">Excess Mileage Rate</p>
                    <p className="text-sm font-medium">${v.excessMileageRate}/mi</p>
                  </div>
                )}
              </div>
              {/* Mileage Tracking */}
              {v.contractMileage && v.contractMileage > 0 && (
                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Mileage Tracking</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Allowed Mileage</p>
                      <p className="text-sm font-medium">{formatNumber(v.contractMileage)} mi</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Current Mileage</p>
                      <p className="text-sm font-medium">{formatNumber(v.odometer)} mi</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Mileage {v.odometer > v.contractMileage ? "Over" : "Under"}</p>
                      <p className={`text-sm font-semibold ${v.odometer > v.contractMileage ? "text-red-600" : "text-green-600"}`}>
                        {v.odometer > v.contractMileage ? "+" : "-"}{formatNumber(Math.abs(v.odometer - v.contractMileage))} mi
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* P&L Summary */}
              {v.totalRentPerMonth && !v.paidOff && (
                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Monthly Cost Summary</p>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-400">Monthly Payment</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(v.monthlyPayment ?? v.totalRentPerMonth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total Paid to Date</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(totalLeasePaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Remaining Obligation</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency((v.monthlyPayment ?? v.totalRentPerMonth) * (v.monthsLeftPayoff ?? 0))}</p>
                    </div>
                    {v.residualValue && (
                      <div>
                        <p className="text-xs text-slate-400">Residual Value</p>
                        <p className="text-lg font-bold text-slate-800">{formatCurrency(v.residualValue)}</p>
                      </div>
                    )}
                  </div>
                  {v.currentMarketValue != null && v.openEndNetBookValue != null && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">
                        Total Loss Settlement: Market value ({formatCurrency(v.currentMarketValue)}) vs. Net Book Value ({formatCurrency(v.openEndNetBookValue)})
                        {v.currentMarketValue >= v.openEndNetBookValue
                          ? <span className="ml-1 font-semibold text-green-600">→ Positive equity of {formatCurrency(v.currentMarketValue - v.openEndNetBookValue)}</span>
                          : <span className="ml-1 font-semibold text-red-600">→ Negative equity of {formatCurrency(v.openEndNetBookValue - v.currentMarketValue)}</span>
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* PM Schedule Section */}
      <div className="mt-6">
        <Card>
          <CardHeader title="PM Schedule" subtitle={`Based on ${formatNumber(odo)} mi odometer`} />
          {(alertRows.length > 0 || timeAlerts.length > 0) && (
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-red-600"><AlertTriangle size={12} /> Alerts — Services Never Performed or Overdue</p>
              <div className="space-y-1">
                {alertRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status === "never_performed" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                        {r.status === "never_performed" ? "Never Done" : "Overdue"}
                      </span>
                      <span className="font-medium text-slate-800">{r.service}</span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500">Next due at {r.nextDue.toLocaleString()} mi</span>
                      {r.milesUntil > 0
                        ? <span className="ml-2 font-semibold text-amber-600">{r.milesUntil.toLocaleString()} mi until</span>
                        : <span className="ml-2 font-semibold text-red-600">{Math.abs(r.milesUntil).toLocaleString()} mi past</span>}
                    </div>
                  </div>
                ))}
                {timeAlerts.map((r, i) => (
                  <div key={`t-${i}`} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        {r.status === "never_performed" ? "Never Done" : "Overdue"}
                      </span>
                      <span className="font-medium text-slate-800">{r.service}</span>
                    </div>
                    <span className="text-xs text-slate-500">{r.nextDueDate ? `Due: ${r.nextDueDate}` : ""} {r.daysTil != null ? `(${Math.abs(r.daysTil)}d ago)` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {upcomingRows.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <p className="mb-2 text-xs font-bold uppercase text-amber-600">Upcoming Services (within 2,000 mi)</p>
              <div className="space-y-1">
                {upcomingRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Upcoming</span>
                      <span className="font-medium text-slate-800">{r.service}</span>
                    </div>
                    <div className="text-right text-xs">
                      {r.lastAt != null && <span className="mr-2 text-slate-400">Last: {r.lastAt.toLocaleString()} mi</span>}
                      <span className="text-slate-500">Due at {r.nextDue.toLocaleString()} mi</span>
                      <span className="ml-2 font-semibold text-amber-600">{r.milesUntil.toLocaleString()} mi left</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="px-5 py-3">
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">Full Schedule</p>
            <Table>
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Service</Th>
                  <Th>Interval</Th>
                  <Th>Last Done At</Th>
                  <Th>Next Due At</Th>
                  <Th>Miles Until</Th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((r, i) => (
                  <tr key={i} className={r.status === "never_performed" ? "bg-red-50/50" : r.status === "overdue" ? "bg-orange-50/50" : ""}>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        r.status === "never_performed" ? "bg-red-100 text-red-700"
                        : r.status === "overdue" ? "bg-orange-100 text-orange-700"
                        : r.status === "upcoming" ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                      }`}>
                        {r.status === "never_performed" ? "Never Done" : r.status === "overdue" ? "Overdue" : r.status === "upcoming" ? "Upcoming" : "On Track"}
                      </span>
                    </Td>
                    <Td className="font-medium">{r.service}</Td>
                    <Td className="text-xs text-slate-400">Every {r.interval.toLocaleString()} mi</Td>
                    <Td>{r.lastAt != null ? <><span className="font-medium">{r.lastAt.toLocaleString()} mi</span>{r.lastDate && <span className="block text-[10px] text-slate-400">{r.lastDate}</span>}</> : <span className="text-slate-300">Never</span>}</Td>
                    <Td className="font-medium">{r.nextDue.toLocaleString()} mi</Td>
                    <Td className={`font-medium ${r.milesUntil < 0 ? "text-red-600" : r.milesUntil <= 2000 ? "text-amber-600" : "text-slate-500"}`}>
                      {r.milesUntil > 0 ? `${r.milesUntil.toLocaleString()} mi` : `${Math.abs(r.milesUntil).toLocaleString()} mi past`}
                    </Td>
                  </tr>
                ))}
                {timeRows.map((r, i) => (
                  <tr key={`t-${i}`} className={r.status === "never_performed" ? "bg-red-50/50" : r.status === "overdue" ? "bg-orange-50/50" : ""}>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        r.status === "never_performed" ? "bg-red-100 text-red-700"
                        : r.status === "overdue" ? "bg-orange-100 text-orange-700"
                        : r.status === "upcoming" ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                      }`}>
                        {r.status === "never_performed" ? "Never Done" : r.status === "overdue" ? "Overdue" : r.status === "upcoming" ? "Upcoming" : "On Track"}
                      </span>
                    </Td>
                    <Td className="font-medium">{r.service}</Td>
                    <Td className="text-xs text-slate-400">Every {r.intervalMonths} months</Td>
                    <Td>{r.lastDate ? <span className="font-medium">{r.lastDate}</span> : <span className="text-slate-300">Never</span>}</Td>
                    <Td>{r.nextDueDate ?? <span className="text-slate-300">—</span>}</Td>
                    <Td className={`font-medium ${r.daysTil != null && r.daysTil < 0 ? "text-red-600" : r.daysTil != null && r.daysTil <= 30 ? "text-amber-600" : "text-slate-500"}`}>
                      {r.daysTil != null ? (r.daysTil > 0 ? `${r.daysTil} days` : `${Math.abs(r.daysTil)} days past`) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Maintenance History" />
          {v.maintenance.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No records.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Work Order</Th>
                  <Th>Mileage</Th>
                  <Th>Status</Th>
                  <Th>Priority</Th>
                  <Th>Cost</Th>
                </tr>
              </thead>
              <tbody>
                {v.maintenance.map((w) => (
                  <tr key={w.id}>
                    <Td>
                      <p className="font-medium">{w.title}</p>
                      <p className="text-xs text-slate-400">{titleCase(w.type)}{w.completedAt ? ` · ${formatDate(w.completedAt)}` : ""}</p>
                    </Td>
                    <Td className="text-slate-600">
                      {w.odometerAt && w.odometerAt > 0
                        ? `${Number(w.odometerAt).toLocaleString()} mi`
                        : w.completedAt && estimateOdoAtDate(new Date(w.completedAt).getTime()) !== null
                          ? <span className="text-blue-500" title="Estimated from date">~{estimateOdoAtDate(new Date(w.completedAt).getTime())!.toLocaleString()} mi</span>
                          : <span className="text-slate-300">—</span>}
                    </Td>
                    <Td>
                      <Badge
                        bg={WO_STATUS[w.status as keyof typeof WO_STATUS].bg}
                        fg={WO_STATUS[w.status as keyof typeof WO_STATUS].fg}
                      >
                        {WO_STATUS[w.status as keyof typeof WO_STATUS].label}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge
                        bg={PRIORITY[w.priority as keyof typeof PRIORITY].bg}
                        fg={PRIORITY[w.priority as keyof typeof PRIORITY].fg}
                      >
                        {PRIORITY[w.priority as keyof typeof PRIORITY].label}
                      </Badge>
                    </Td>
                    <Td>{formatCurrency(w.cost)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Trips" />
          {v.trips.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No trips.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Route</Th>
                  <Th>Driver</Th>
                  <Th>Date</Th>
                  <Th>Distance</Th>
                </tr>
              </thead>
              <tbody>
                {v.trips.map((t) => (
                  <tr key={t.id}>
                    <Td>
                      {t.origin} → {t.destination}
                    </Td>
                    <Td className="text-slate-600">
                      {t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : "—"}
                    </Td>
                    <Td className="text-slate-600">{formatDate(t.scheduledStart)}</Td>
                    <Td>{Math.round(t.distanceKm)} mi</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

function ComplianceRow({
  label,
  date,
  days,
}: {
  label: string;
  date: Date | null;
  days: number | null;
}) {
  const expired = days != null && days < 0;
  const soon = days != null && days >= 0 && days < 30;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {expired ? (
          <Calendar size={16} className="text-red-500" />
        ) : (
          <ShieldCheck size={16} className={soon ? "text-amber-500" : "text-emerald-500"} />
        )}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatDate(date)}</p>
        {days != null && (
          <p
            className={
              "text-xs " +
              (expired ? "text-red-500" : soon ? "text-amber-600" : "text-slate-400")
            }
          >
            {expired ? `Expired ${-days}d ago` : `${days}d remaining`}
          </p>
        )}
      </div>
    </div>
  );
}
