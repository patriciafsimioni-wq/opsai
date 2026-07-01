import Link from "next/link";
import {
  Truck,
  Activity,
  AlertTriangle,
  Wrench,
  Fuel,
  Users,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardHeader, StatCard, Badge, Avatar } from "@/components/ui";
import { DonutChart, BarChartCard, AreaChartCard } from "@/components/charts";
import {
  VEHICLE_STATUS,
  ALERT_SEVERITY,
  ALERT_TYPE_LABEL,
} from "@/lib/constants";
import { formatCurrency, relativeTime, formatDate } from "@/lib/utils";
import { StationFilter } from "@/components/StationFilter";
import type { Station } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const params = await searchParams;
  const station = (params.station as Station) || null;

  const vehicleWhere = station ? { station } : {};
  const [allVehicles, drivers, fareyeRoutes, alerts, workOrders, fuelLogs] =
    await Promise.all([
      prisma.vehicle.findMany({ where: vehicleWhere }),
      prisma.driver.findMany({ where: station ? { station } : {}, orderBy: { safetyScore: "desc" } }),
      prisma.fareyeRoute.findMany({ where: station ? { station } : {} }),
      prisma.alert.findMany({
        orderBy: { createdAt: "desc" },
        include: { vehicle: true },
        where: { type: { notIn: ["SPEEDING", "HARSH_DRIVING"] }, ...(station ? { vehicle: { station } } : {}) },
        take: 6,
      }),
      prisma.workOrder.findMany({ include: { vehicle: true }, where: station ? { vehicle: { station } } : {} }),
      prisma.fuelLog.findMany({ where: station ? { vehicle: { station } } : {} }),
    ]);
  const vehicles = allVehicles;

  const statusCounts = {
    ACTIVE: vehicles.filter((v) => v.status === "ACTIVE").length,
    IDLE: vehicles.filter((v) => v.status === "IDLE").length,
    MAINTENANCE: vehicles.filter((v) => v.status === "MAINTENANCE").length,
    OUT_OF_SERVICE: vehicles.filter((v) => v.status === "OUT_OF_SERVICE").length,
  };

  const unreadAlerts = await prisma.alert.count({ where: { read: false, type: { notIn: ["SPEEDING", "HARSH_DRIVING"] }, ...(station ? { vehicle: { station } } : {}) } });
  const openWO = workOrders.filter(
    (w) => w.status === "OPEN" || w.status === "SCHEDULED" || w.status === "IN_PROGRESS",
  ).length;
  const todayStr = new Date().toDateString();
  const todayRoutes = fareyeRoutes.filter(
    (r) => new Date(r.date).toDateString() === todayStr,
  ).length;

  // fuel cost last 30 days
  const now = new Date().getTime();
  const fuel30 = fuelLogs
    .filter((f) => now - new Date(f.date).getTime() < 30 * 86400000)
    .reduce((s, f) => s + f.totalCost, 0);

  // maintenance cost (completed, last 90 days)
  const maint90 = workOrders
    .filter(
      (w) =>
        w.status === "COMPLETED" &&
        w.completedAt &&
        now - new Date(w.completedAt).getTime() < 90 * 86400000,
    )
    .reduce((s, w) => s + w.cost, 0);

  // donut data
  const donut = (
    Object.keys(statusCounts) as (keyof typeof statusCounts)[]
  ).map((k) => ({
    name: VEHICLE_STATUS[k].label,
    value: statusCounts[k],
    color: VEHICLE_STATUS[k].color,
  }));

  // fareye routes – planned miles last 7 days
  const routeMilesPerDay: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now - i * 86400000);
    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    const miles = fareyeRoutes
      .filter((r) => new Date(r.date).toDateString() === day.toDateString())
      .reduce((s, r) => s + r.miles, 0);
    routeMilesPerDay.push({ label, value: Math.round(miles) });
  }

  // fuel cost trend last 8 weeks
  const fuelTrend: { label: string; value: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 86400000;
    const end = now - i * 7 * 86400000;
    const cost = fuelLogs
      .filter((f) => {
        const t = new Date(f.date).getTime();
        return t >= start && t < end;
      })
      .reduce((s, f) => s + f.totalCost, 0);
    const weekDate = new Date(start);
    const label = weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    fuelTrend.push({ label, value: Math.round(cost) });
  }

  const utilization =
    vehicles.length > 0
      ? Math.round((statusCounts.ACTIVE / vehicles.length) * 100)
      : 0;

  // This week stats
  const weekStart = now - 7 * 86400000;
  const prevWeekStart = now - 14 * 86400000;
  const fuelThisWeek = fuelLogs
    .filter((f) => new Date(f.date).getTime() >= weekStart)
    .reduce((s, f) => s + f.totalCost, 0);
  const fuelLastWeek = fuelLogs
    .filter((f) => { const t = new Date(f.date).getTime(); return t >= prevWeekStart && t < weekStart; })
    .reduce((s, f) => s + f.totalCost, 0);
  const servicesThisWeek = workOrders
    .filter((w) => w.completedAt && new Date(w.completedAt).getTime() >= weekStart).length;
  const servicesLastWeek = workOrders
    .filter((w) => w.completedAt && new Date(w.completedAt).getTime() >= prevWeekStart && new Date(w.completedAt).getTime() < weekStart).length;
  const routesThisWeek = fareyeRoutes
    .filter((r) => new Date(r.date).getTime() >= weekStart).length;
  const milesThisWeek = fareyeRoutes
    .filter((r) => new Date(r.date).getTime() >= weekStart)
    .reduce((s, r) => s + r.miles, 0);
  const fillUpsThisWeek = fuelLogs
    .filter((f) => new Date(f.date).getTime() >= weekStart).length;

  // Compliance audit — registration & insurance
  const nowDate = new Date();
  const in60Date = new Date(nowDate.getTime() + 60 * 86400000);
  const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE" || v.status === "IDLE");
  const regExpired = activeVehicles.filter((v) => v.registrationExpiry && new Date(v.registrationExpiry) < nowDate);
  const regExpiringSoon = activeVehicles.filter((v) => v.registrationExpiry && new Date(v.registrationExpiry) >= nowDate && new Date(v.registrationExpiry) <= in60Date);
  const regMissing = activeVehicles.filter((v) => !v.registrationExpiry);
  const insExpired = activeVehicles.filter((v) => v.insuranceExpiry && new Date(v.insuranceExpiry) < nowDate);
  const insExpiringSoon = activeVehicles.filter((v) => v.insuranceExpiry && new Date(v.insuranceExpiry) >= nowDate && new Date(v.insuranceExpiry) <= in60Date);
  const complianceIssues = regExpired.length + regMissing.length + insExpired.length;

  // Recently onboarded & offboarded vehicles (last 30 days)
  const recentOnboarded = vehicles
    .filter((v) => v.onboardedDate && now - new Date(v.onboardedDate).getTime() < 30 * 86400000)
    .sort((a, b) => new Date(b.onboardedDate!).getTime() - new Date(a.onboardedDate!).getTime())
    .slice(0, 8);
  const recentOffboarded = vehicles
    .filter((v) => v.offboardedDate && now - new Date(v.offboardedDate).getTime() < 30 * 86400000)
    .sort((a, b) => new Date(b.offboardedDate!).getTime() - new Date(a.offboardedDate!).getTime())
    .slice(0, 8);

  // Vehicles missing Samsara camera or not transmitting (no lastSeen in 24h)
  const noCamera = vehicles.filter((v) => (v.status === "ACTIVE" || v.status === "IDLE") && !v.hasSamsaraCamera);
  const notTransmitting = vehicles.filter((v) => (v.status === "ACTIVE" || v.status === "IDLE") && v.samsaraId && v.lastSeen && now - new Date(v.lastSeen).getTime() > 24 * 3600000);

  const topDrivers = drivers.slice(0, 5);
  const upcomingMaint = workOrders
    .filter((w) => w.scheduledFor && (w.status === "OPEN" || w.status === "SCHEDULED"))
    .sort(
      (a, b) =>
        new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime(),
    )
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet Overview</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Real-time snapshot of your {station ? `${station} station` : "entire operation"}.
          </p>
        </div>
        <StationFilter />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard
          label="Vehicles"
          value={vehicles.length}
          icon={<Truck size={20} />}
          accent="#2563eb"
        />
        <StatCard
          label="Active Now"
          value={statusCounts.ACTIVE}
          icon={<Activity size={20} />}
          accent="#16a34a"
          hint={`${utilization}% utilization`}
        />
        <StatCard
          label="Drivers"
          value={drivers.length}
          icon={<Users size={20} />}
          accent="#7c3aed"
        />
        <StatCard
          label="Open Alerts"
          value={unreadAlerts}
          icon={<AlertTriangle size={20} />}
          accent="#dc2626"
        />
        <StatCard
          label="Open Work Orders"
          value={openWO}
          icon={<Wrench size={20} />}
          accent="#d97706"
        />
        <StatCard
          label="Fuel (30d)"
          value={formatCurrency(fuel30)}
          icon={<Fuel size={20} />}
          accent="#0891b2"
        />
      </div>

      {/* This Week Summary */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-400 uppercase">Fuel Spend This Week</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(fuelThisWeek)}</p>
          {fuelLastWeek > 0 && (
            <p className={`mt-0.5 text-xs ${fuelThisWeek <= fuelLastWeek ? "text-emerald-600" : "text-red-500"}`}>
              {fuelThisWeek <= fuelLastWeek ? "↓" : "↑"} {Math.abs(Math.round(((fuelThisWeek - fuelLastWeek) / fuelLastWeek) * 100))}% vs last week
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">{fillUpsThisWeek} fill-ups</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-400 uppercase">Services Completed</p>
          <p className="mt-1 text-xl font-bold">{servicesThisWeek}</p>
          {servicesLastWeek > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              vs {servicesLastWeek} last week
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">this week</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-400 uppercase">Routes Dispatched</p>
          <p className="mt-1 text-xl font-bold">{routesThisWeek}</p>
          <p className="mt-0.5 text-xs text-slate-500">{Math.round(milesThisWeek).toLocaleString()} miles planned</p>
          <p className="mt-1 text-xs text-slate-400">this week</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-400 uppercase">Maintenance Cost (90d)</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(maint90)}</p>
          <p className="mt-1 text-xs text-slate-400">completed work orders</p>
        </div>
      </div>

      {/* charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Fleet Status" subtitle="Live distribution" />
          <div className="p-4">
            <DonutChart data={donut} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {donut.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-slate-600">{d.name}</span>
                  <span className="ml-auto font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="FareEye Routes" subtitle="Planned miles · last 7 days" />
          <div className="p-4">
            <BarChartCard data={routeMilesPerDay} color="#7c3aed" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Fuel Spend"
            subtitle="Weekly trend"
            action={
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <TrendingUp size={14} /> Last 8 weeks
              </span>
            }
          />
          <div className="p-4">
            <AreaChartCard data={fuelTrend} color="#0891b2" prefix="$" />
          </div>
        </Card>
      </div>

      {/* lower panels */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* recent alerts */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Alerts"
            subtitle="Latest events across the fleet"
            action={
              <Link href="/alerts" className="text-xs font-medium text-blue-600 hover:underline">
                View all
              </Link>
            }
          />
          <div className="divide-y divide-[var(--color-border)]">
            {alerts.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                No alerts.
              </p>
            )}
            {alerts.map((a) => {
              const sev = ALERT_SEVERITY[a.severity];
              const href = a.vehicleId
                ? `/vehicles/${a.vehicleId}`
                : a.driverId
                  ? `/drivers/${a.driverId}`
                  : "/alerts";
              return (
                <Link key={a.id} href={href} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: sev.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.message}</p>
                    <p className="text-xs text-slate-400">
                      {ALERT_TYPE_LABEL[a.type]} · {relativeTime(a.createdAt)}
                    </p>
                  </div>
                  <Badge bg={sev.bg} fg={sev.fg}>
                    {sev.label}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* top drivers */}
        <Card>
          <CardHeader title="Top Drivers" subtitle="By safety score" />
          <div className="divide-y divide-[var(--color-border)]">
            {topDrivers.map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-4 text-sm font-bold text-slate-300">
                  {i + 1}
                </span>
                <Avatar
                  name={`${d.firstName} ${d.lastName}`}
                  color={d.avatarColor}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {d.firstName} {d.lastName}
                  </p>
                  <p className="text-xs text-slate-400">★ {d.rating.toFixed(1)}</p>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{
                    color:
                      d.safetyScore >= 85
                        ? "#16a34a"
                        : d.safetyScore >= 70
                          ? "#d97706"
                          : "#dc2626",
                  }}
                >
                  {d.safetyScore}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Compliance Audit */}
      {(complianceIssues > 0 || regExpiringSoon.length > 0 || insExpiringSoon.length > 0) && (
        <div className="mt-6">
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader
              title="Compliance Audit"
              subtitle="Registration & Insurance — Priority"
              action={
                <Link href="/vehicles" className="text-xs font-medium text-red-600 hover:underline">
                  View Vehicles
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
              <div className="rounded-lg border border-red-200 bg-white p-3">
                <p className="text-xs font-medium text-red-600">Reg. Expired</p>
                <p className="mt-1 text-2xl font-bold text-red-700">{regExpired.length}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-xs font-medium text-amber-600">Reg. Expiring (60d)</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{regExpiringSoon.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-medium text-slate-600">Reg. Missing</p>
                <p className="mt-1 text-2xl font-bold text-slate-700">{regMissing.length}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-white p-3">
                <p className="text-xs font-medium text-red-600">Ins. Expired</p>
                <p className="mt-1 text-2xl font-bold text-red-700">{insExpired.length}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-xs font-medium text-amber-600">Ins. Expiring (60d)</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{insExpiringSoon.length}</p>
              </div>
            </div>
            {regExpired.length > 0 && (
              <div className="border-t border-red-200 px-5 py-3">
                <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-red-600"><ShieldAlert size={12} /> Expired Registrations</p>
                <div className="flex flex-wrap gap-2">
                  {regExpired.slice(0, 15).map((v) => (
                    <Link key={v.id} href={`/vehicles/${v.id}`} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors">
                      {v.dxNumber ?? v.name} <span className="text-red-400">· exp {formatDate(v.registrationExpiry)}</span>
                    </Link>
                  ))}
                  {regExpired.length > 15 && <span className="px-3 py-1.5 text-xs text-red-400">+{regExpired.length - 15} more</span>}
                </div>
              </div>
            )}
            {regMissing.length > 0 && (
              <div className="border-t border-red-200 px-5 py-3">
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">Missing Registration Date</p>
                <div className="flex flex-wrap gap-2">
                  {regMissing.slice(0, 15).map((v) => (
                    <Link key={v.id} href={`/vehicles/${v.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      {v.dxNumber ?? v.name}
                    </Link>
                  ))}
                  {regMissing.length > 15 && <span className="px-3 py-1.5 text-xs text-slate-400">+{regMissing.length - 15} more</span>}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Vehicle Onboarding / Offboarding & Samsara Status */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recently Onboarded */}
        <Card>
          <CardHeader title="Recently Onboarded" subtitle="Last 30 days" />
          <div className="divide-y divide-[var(--color-border)]">
            {recentOnboarded.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No recent onboards.</p>
            )}
            {recentOnboarded.map((v) => (
              <Link key={v.id} href={`/vehicles/${v.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-50 text-green-600 text-xs font-bold">+</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.dxNumber ?? v.name}</p>
                  <p className="text-xs text-slate-400">{v.year} {v.make} {v.model}</p>
                </div>
                <span className="text-[10px] text-slate-400">{formatDate(v.onboardedDate)}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Recently Offboarded */}
        <Card>
          <CardHeader title="Recently Offboarded" subtitle="Last 30 days" />
          <div className="divide-y divide-[var(--color-border)]">
            {recentOffboarded.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No recent offboards.</p>
            )}
            {recentOffboarded.map((v) => (
              <Link key={v.id} href={`/vehicles/${v.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600 text-xs font-bold">−</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.dxNumber ?? v.name}</p>
                  <p className="text-xs text-slate-400">{v.offboardReason ?? "No reason"}</p>
                </div>
                <span className="text-[10px] text-slate-400">{formatDate(v.offboardedDate)}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Samsara Camera / Transmission Issues */}
        <Card className={noCamera.length + notTransmitting.length > 0 ? "border-amber-200" : ""}>
          <CardHeader title="Samsara Status" subtitle="Camera & Transmission" />
          <div className="p-5 space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-medium text-amber-700">Missing Camera</p>
              <p className="text-2xl font-bold text-amber-800">{noCamera.length}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">active vehicles without Samsara camera</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-medium text-red-700">Not Transmitting</p>
              <p className="text-2xl font-bold text-red-800">{notTransmitting.length}</p>
              <p className="text-[10px] text-red-600 mt-0.5">no data in 24h</p>
            </div>
            {noCamera.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">No Camera:</p>
                <div className="flex flex-wrap gap-1">
                  {noCamera.slice(0, 10).map((v) => (
                    <Link key={v.id} href={`/vehicles/${v.id}`} className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-200">
                      {v.dxNumber ?? v.name}
                    </Link>
                  ))}
                  {noCamera.length > 10 && <span className="text-[10px] text-slate-400 px-1">+{noCamera.length - 10}</span>}
                </div>
              </div>
            )}
            {notTransmitting.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">Not Transmitting:</p>
                <div className="flex flex-wrap gap-1">
                  {notTransmitting.slice(0, 10).map((v) => (
                    <Link key={v.id} href={`/vehicles/${v.id}`} className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-200">
                      {v.dxNumber ?? v.name}
                    </Link>
                  ))}
                  {notTransmitting.length > 10 && <span className="text-[10px] text-slate-400 px-1">+{notTransmitting.length - 10}</span>}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* upcoming maintenance */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming Maintenance"
            subtitle="Scheduled work orders"
            action={
              <Link href="/maintenance" className="text-xs font-medium text-blue-600 hover:underline">
                View all
              </Link>
            }
          />
          <div className="divide-y divide-[var(--color-border)]">
            {upcomingMaint.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                Nothing scheduled.
              </p>
            )}
            {upcomingMaint.map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Wrench size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.title}</p>
                  <p className="text-xs text-slate-400">{w.vehicle.name}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {formatDate(w.scheduledFor)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Cost Summary" subtitle="Operational spend" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-[var(--color-border)]">
            <div className="bg-white p-5">
              <p className="text-xs text-slate-400">Fuel · 30 days</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(fuel30)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs text-slate-400">Maintenance · 90 days</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(maint90)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs text-slate-400">Today&apos;s Routes</p>
              <p className="mt-1 text-xl font-bold">{todayRoutes}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs text-slate-400">Fleet Utilization</p>
              <p className="mt-1 text-xl font-bold">{utilization}%</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
