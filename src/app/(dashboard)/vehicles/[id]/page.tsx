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
import {
  VEHICLE_STATUS,
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
      fuelLogs: { orderBy: { date: "desc" }, take: 10 },
      trips: { orderBy: { scheduledStart: "desc" }, take: 8, include: { driver: true } },
    },
  });
  if (!v) notFound();

  const status = VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS];
  const totalFuelCost = v.fuelLogs.reduce((s, f) => s + f.totalCost, 0);
  const totalMaintCost = v.maintenance
    .filter((w) => w.status === "COMPLETED")
    .reduce((s, w) => s + w.cost, 0);
  const regDays = daysUntil(v.registrationExpiry);
  const insDays = daysUntil(v.insuranceExpiry);

  // Compute maintenance schedule for this vehicle
  const completedWOs = v.maintenance.filter((w) => w.status === "COMPLETED");
  const lastPerformed: Record<string, { odometerAt: number; completedAt: Date }> = {};
  for (const wo of completedWOs) {
    const svcName = matchService(wo.title);
    if (!svcName) continue;
    if (!lastPerformed[svcName] && wo.odometerAt != null && wo.completedAt) {
      lastPerformed[svcName] = { odometerAt: wo.odometerAt, completedAt: wo.completedAt };
    }
  }
  const odo = v.odometer;
  const now = new Date();
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
      nextDue = firstDue;
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
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {v.year} {v.make} {v.model} · {titleCase(v.type)} · {v.licensePlate}
            {v.dxNumber ? ` · ${v.dxNumber}` : ""}
          </p>
        </div>
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
          <CardHeader title="Lifetime Costs" />
          <div className="space-y-4 p-5">
            <div>
              <p className="text-xs text-slate-400">Fuel (recent)</p>
              <p className="text-xl font-bold">{formatCurrency(totalFuelCost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Maintenance (completed)</p>
              <p className="text-xl font-bold">{formatCurrency(totalMaintCost)}</p>
            </div>
          </div>
        </Card>
      </div>

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
                      <span className="text-slate-500">Due at {r.nextDue.toLocaleString()} mi</span>
                      <span className="ml-2 font-semibold text-red-600">{Math.abs(r.milesUntil).toLocaleString()} mi past</span>
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
                      {w.odometerAt ? `${Number(w.odometerAt).toLocaleString()} mi` : <span className="text-slate-300">—</span>}
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
