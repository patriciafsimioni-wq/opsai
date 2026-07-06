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
  Flag,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardHeader, StatCard, Badge, Avatar } from "@/components/ui";
import { DonutChart, BarChartCard, AreaChartCard } from "@/components/charts";
import {
  VEHICLE_STATUS,
  ALERT_SEVERITY,
  ALERT_TYPE_LABEL,
  STATION_TARGETS,
  STATION_LABEL,
} from "@/lib/constants";
import { formatCurrency, relativeTime, formatDate } from "@/lib/utils";
import { StationFilter } from "@/components/StationFilter";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";
import type { Station } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const params = await searchParams;
  const station = (params.station as Station) || null;

  const user = await getSession();
  const cookieStore = await cookies();
  const viewAsRoleCookie = cookieStore.get("viewAsRole")?.value || null;
  const isRealAdmin = user && (user.role === "ADMIN" || user.role === "GENERAL_MANAGER" || user.role === "FLEET_MANAGER");
  const role = (isRealAdmin && viewAsRoleCookie) ? viewAsRoleCookie : (user?.role ?? "DRIVER");

  const isAdmin = ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"].includes(role);
  const isManager = [...["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"], "STATION_MANAGER", "MANAGER"].includes(role);
  const isMechanic = role === "MECHANIC";
  const isVendor = role === "VENDOR";
  const isDriver = role === "DRIVER";

  const canSeeFuel = isManager;
  const canSeeDrivers = isManager;
  const canSeeRoutes = isManager;
  const canSeeAlerts = isManager || isMechanic;
  const canSeeCompliance = isAdmin;
  const canSeeFinance = isManager;

  const vehicleWhere = station ? { station } : {};
  const [allVehicles, drivers, fareyeRoutes, alerts, workOrders, fuelLogs, issues] =
    await Promise.all([
      prisma.vehicle.findMany({ where: vehicleWhere }),
      prisma.driver.findMany({ where: station ? { station } : {}, orderBy: { safetyScore: "desc" } }),
      prisma.fareyeRoute.findMany({ where: station ? { station } : {} }),
      prisma.alert.findMany({
        orderBy: { createdAt: "desc" },
        include: { vehicle: true },
        where: { type: { notIn: ["SPEEDING", "HARSH_DRIVING"] }, ...(station ? { vehicle: { station } } : {}) },
        take: 20,
      }),
      prisma.workOrder.findMany({ include: { vehicle: true }, where: station ? { vehicle: { station } } : {} }),
      prisma.fuelLog.findMany({ where: station ? { vehicle: { station } } : {} }),
      (async () => {
        const user = await getSession();
        const adminRoles = ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"];
        const issueWhere: Record<string, unknown> = { status: { in: ["OPEN", "IN_PROGRESS"] }, ...(station ? { station } : {}) };
        if (user && !adminRoles.includes(user.role)) {
          issueWhere.OR = [{ createdById: user.id }, { assignedToId: user.id }];
        }
        return prisma.issue.findMany({
          where: issueWhere,
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { name: true } }, assignedTo: { select: { name: true } } },
          take: 5,
        });
      })(),
    ]);
  const vehicles = allVehicles;
  // Fleet total excludes vehicles off-boarded or in the off-boarding process —
  // those are managed on the Off-boarding page and must not inflate counts.
  const fleetVehicles = vehicles.filter(
    (v) => v.offboardStatus !== "IN_PROGRESS" && v.offboardStatus !== "COMPLETED",
  );

  const statusCounts = {
    ACTIVE: fleetVehicles.filter((v) => v.status === "ACTIVE").length,
    IDLE: fleetVehicles.filter((v) => v.status === "IDLE").length,
    MAINTENANCE: fleetVehicles.filter((v) => v.status === "MAINTENANCE").length,
    OUT_OF_SERVICE: fleetVehicles.filter((v) => v.status === "OUT_OF_SERVICE").length,
  };

  // Fleet plan vs actual — active vehicles per station across the whole fleet
  // (independent of the station filter), compared to DHL contracted targets.
  const activeStationFilter = {
    OR: [
      { offboardStatus: null },
      { offboardStatus: { notIn: ["IN_PROGRESS", "COMPLETED"] } },
    ],
  };
  const activeByStation = await prisma.vehicle.groupBy({
    by: ["station"],
    where: activeStationFilter,
    _count: true,
  });
  const stationActual: Record<string, number> = {};
  for (const s of activeByStation) if (s.station) stationActual[s.station] = s._count;
  const planRows = Object.keys(STATION_TARGETS)
    .map((st) => {
      const target = STATION_TARGETS[st];
      const actual = stationActual[st] ?? 0;
      return { station: st, target, actual, delta: actual - target };
    })
    .sort((a, b) => b.target - a.target);
  const planTargetTotal = planRows.reduce((s, r) => s + r.target, 0);
  const planActualTotal = planRows.reduce((s, r) => s + r.actual, 0);

  // Live on Samsara — vehicles currently running (engine on) per station.
  const liveByStationRaw = await prisma.vehicle.groupBy({
    by: ["station"],
    where: { engineOn: true, ...activeStationFilter },
    _count: true,
  });
  const liveByStation: Record<string, number> = {};
  for (const s of liveByStationRaw) if (s.station) liveByStation[s.station] = s._count;
  const liveStationRows = Object.keys(STATION_TARGETS)
    .map((st) => ({ station: st, live: liveByStation[st] ?? 0 }))
    .sort((a, b) => b.live - a.live);
  const liveTotal = liveStationRows.reduce((s, r) => s + r.live, 0);

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
    fleetVehicles.length > 0
      ? Math.round((statusCounts.ACTIVE / fleetVehicles.length) * 100)
      : 0;

  // maintenance spend — monthly, last 6 months (completed work orders)
  const nowForTrend = new Date();
  const maintMonthly: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(nowForTrend.getFullYear(), nowForTrend.getMonth() - i, 1);
    const end = new Date(nowForTrend.getFullYear(), nowForTrend.getMonth() - i + 1, 1);
    const cost = workOrders
      .filter(
        (w) =>
          w.status === "COMPLETED" &&
          w.completedAt &&
          new Date(w.completedAt) >= start &&
          new Date(w.completedAt) < end,
      )
      .reduce((s, w) => s + w.cost, 0);
    maintMonthly.push({ label: start.toLocaleDateString("en-US", { month: "short" }), value: Math.round(cost) });
  }

  // greeting header
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (user?.name ?? "").split(" ")[0] || "there";
  const todayLong = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

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

  // Vehicle Age Compliance: cargo vans < 4 years, box trucks < 7 years
  const currentYear = nowDate.getFullYear();
  const agingVehicles = activeVehicles
    .filter((v) => {
      if (!v.year) return false;
      const age = currentYear - v.year;
      const maxAge = v.type === "VAN" ? 4 : 7;
      // Flag if within 12 months of limit or past it
      return age >= maxAge - 1;
    })
    .map((v) => {
      const age = currentYear - (v.year ?? currentYear);
      const maxAge = v.type === "VAN" ? 4 : 7;
      const overdue = age >= maxAge;
      const monthsToLeaseEnd = v.leaseEndDate
        ? Math.round((new Date(v.leaseEndDate).getTime() - nowDate.getTime()) / (30 * 86400000))
        : null;
      return { ...v, age, maxAge, overdue, monthsToLeaseEnd };
    })
    .sort((a, b) => (b.age - b.maxAge) - (a.age - a.maxAge));

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
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-100">{todayLong}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-blue-100">
              Real-time snapshot of your {station ? `${station} station` : "entire operation"}.
            </p>
          </div>
          <StationFilter />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/vehicles" className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/15 transition-colors hover:bg-white/20">
            <p className="text-xs font-medium text-blue-100">Fleet Utilization</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-bold">{utilization}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${utilization}%` }} />
            </div>
          </Link>
          <Link href="/vehicles" className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/15 transition-colors hover:bg-white/20">
            <p className="text-xs font-medium text-blue-100">Active / Total</p>
            <p className="mt-1 text-2xl font-bold">{statusCounts.ACTIVE}<span className="text-lg font-medium text-blue-200">/{fleetVehicles.length}</span></p>
            <p className="mt-1 text-xs text-blue-100">vehicles on the road</p>
          </Link>
          {canSeeAlerts && (
            <Link href="/alerts" className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/15 transition-colors hover:bg-white/20">
              <p className="text-xs font-medium text-blue-100">Open Alerts</p>
              <p className="mt-1 text-2xl font-bold">{unreadAlerts}</p>
              <p className="mt-1 text-xs text-blue-100">need attention</p>
            </Link>
          )}
          <Link href="/maintenance" className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/15 transition-colors hover:bg-white/20">
            <p className="text-xs font-medium text-blue-100">Open Work Orders</p>
            <p className="mt-1 text-2xl font-bold">{openWO}</p>
            <p className="mt-1 text-xs text-blue-100">{todayRoutes} routes today</p>
          </Link>
        </div>

        {/* Live on Samsara — running vans per station */}
        <div className="mt-4 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/15">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-blue-100">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live on Samsara · running now
            </p>
            <span className="text-xs font-semibold">{liveTotal} vans</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {liveStationRows.map((r) => (
              <Link
                key={r.station}
                href={`/map?station=${r.station}`}
                className="rounded-lg bg-white/10 px-2 py-1.5 text-center transition-colors hover:bg-white/20"
                title={`${STATION_LABEL[r.station] ?? r.station} — ${r.live} running`}
              >
                <p className="text-[10px] font-medium text-blue-100">{r.station}</p>
                <p className="text-lg font-bold leading-tight">{r.live}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Issue Tracker */}
      <Card className="mb-6">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-amber-600" />
            <h2 className="text-sm font-semibold">Open Issues ({issues.length})</h2>
          </div>
          <Link href="/issues" className="text-xs font-medium text-blue-600 hover:underline">View All</Link>
        </div>
        {issues.length === 0 ? (
          <p className="px-5 py-4 text-center text-sm text-slate-400">No open issues. Create one from the <Link href="/issues" className="text-blue-600 hover:underline">Issue Tracker</Link>.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {issues.map((issue) => {
              const priorityColor = issue.priority === "URGENT" ? "text-red-600" : issue.priority === "HIGH" ? "text-orange-600" : issue.priority === "MEDIUM" ? "text-amber-600" : "text-slate-500";
              const statusBg = issue.status === "OPEN" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
              return (
                <Link key={issue.id} href="/issues" className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Flag size={14} className={priorityColor} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{issue.title}</p>
                      <p className="text-xs text-slate-400">
                        {issue.station && <span className="mr-2">{issue.station}</span>}
                        {issue.assignedTo ? `Assigned to ${issue.assignedTo.name}` : "Unassigned"}
                        {" · "}{relativeTime(issue.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 ml-3 rounded-full px-2 py-0.5 text-xs font-medium ${statusBg}`}>
                    {issue.status === "OPEN" ? "Open" : "In Progress"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard
          label="Vehicles"
          value={fleetVehicles.length}
          icon={<Truck size={20} />}
          accent="#2563eb"
          href="/vehicles"
        />
        <StatCard
          label="Active Now"
          value={statusCounts.ACTIVE}
          icon={<Activity size={20} />}
          accent="#16a34a"
          hint={`${utilization}% utilization`}
          href="/vehicles"
        />
        {canSeeDrivers && (
          <StatCard
            label="Drivers"
            value={drivers.length}
            icon={<Users size={20} />}
            accent="#7c3aed"
            href="/drivers"
          />
        )}
        {canSeeAlerts && (
          <StatCard
            label="Open Alerts"
            value={unreadAlerts}
            icon={<AlertTriangle size={20} />}
            accent="#dc2626"
            href="/alerts"
          />
        )}
        <StatCard
          label="Open Work Orders"
          value={openWO}
          icon={<Wrench size={20} />}
          accent="#d97706"
          href="/maintenance"
        />
        {canSeeFuel && (
          <StatCard
            label="Fuel (30d)"
            value={formatCurrency(fuel30)}
            icon={<Fuel size={20} />}
            accent="#0891b2"
            href="/fuel"
          />
        )}
      </div>

      {/* Fleet Plan vs Actual — DHL station targets */}
      {isManager && (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Fleet Plan vs Actual"
              subtitle="Vehicles running per station vs DHL contracted plan"
              action={
                <span className={`text-xs font-semibold ${planActualTotal > planTargetTotal ? "text-red-600" : planActualTotal < planTargetTotal ? "text-amber-600" : "text-emerald-600"}`}>
                  {planActualTotal} running / {planTargetTotal} planned
                  {planActualTotal !== planTargetTotal && ` · ${planActualTotal > planTargetTotal ? "+" : ""}${planActualTotal - planTargetTotal}`}
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-px overflow-hidden bg-[var(--color-border)] sm:grid-cols-4 lg:grid-cols-7">
              {planRows.map((r) => {
                const over = r.delta > 0;
                const under = r.delta < 0;
                const pct = r.target > 0 ? Math.min(100, Math.round((r.actual / r.target) * 100)) : 0;
                return (
                  <Link
                    key={r.station}
                    href={`/vehicles?station=${r.station}`}
                    className="bg-white p-4 hover:bg-slate-50 transition-colors"
                    title={STATION_LABEL[r.station] ?? r.station}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{r.station}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          over ? "bg-red-100 text-red-700" : under ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {over ? `+${r.delta} over` : under ? `${r.delta} short` : "on plan"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-2xl font-bold">
                      {r.actual}
                      <span className="text-sm font-medium text-slate-400"> / {r.target}</span>
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${over ? "bg-red-500" : "bg-blue-500"}`}
                        style={{ width: `${over ? 100 : pct}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* This Week Summary */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {canSeeFuel && (
          <Link href="/fuel" className="rounded-xl border border-[var(--color-border)] bg-white p-4 hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-slate-400 uppercase">Fuel Spend This Week</p>
            <p className="mt-1 text-xl font-bold">{formatCurrency(fuelThisWeek)}</p>
            {fuelLastWeek > 0 && (
              <p className={`mt-0.5 text-xs ${fuelThisWeek <= fuelLastWeek ? "text-emerald-600" : "text-red-500"}`}>
                {fuelThisWeek <= fuelLastWeek ? "↓" : "↑"} {Math.abs(Math.round(((fuelThisWeek - fuelLastWeek) / fuelLastWeek) * 100))}% vs last week
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">{fillUpsThisWeek} fill-ups</p>
          </Link>
        )}
        <Link href="/maintenance" className="rounded-xl border border-[var(--color-border)] bg-white p-4 hover:shadow-md transition-shadow">
          <p className="text-xs font-medium text-slate-400 uppercase">Services Completed</p>
          <p className="mt-1 text-xl font-bold">{servicesThisWeek}</p>
          {servicesLastWeek > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              vs {servicesLastWeek} last week
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">this week</p>
        </Link>
        {canSeeRoutes && (
          <Link href="/fareye-routes" className="rounded-xl border border-[var(--color-border)] bg-white p-4 hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-slate-400 uppercase">Routes Dispatched</p>
            <p className="mt-1 text-xl font-bold">{routesThisWeek}</p>
            <p className="mt-0.5 text-xs text-slate-500">{Math.round(milesThisWeek).toLocaleString()} miles planned</p>
            <p className="mt-1 text-xs text-slate-400">this week</p>
          </Link>
        )}
        <Link href="/maintenance" className="rounded-xl border border-[var(--color-border)] bg-white p-4 hover:shadow-md transition-shadow">
          <p className="text-xs font-medium text-slate-400 uppercase">Maintenance Cost (90d)</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(maint90)}</p>
          <p className="mt-1 text-xs text-slate-400">completed work orders</p>
        </Link>
      </div>

      {/* charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link href="/vehicles">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
        </Link>

        {canSeeRoutes && (
          <Link href="/fareye-routes">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader title="FareEye Routes" subtitle="Planned miles · last 7 days" />
            <div className="p-4">
              <BarChartCard data={routeMilesPerDay} color="#7c3aed" />
            </div>
          </Card>
          </Link>
        )}

        {canSeeFuel && (
          <Link href="/fuel">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          </Link>
        )}

        {canSeeFinance && (
          <Link href="/maintenance">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader
              title="Maintenance Spend"
              subtitle="Monthly · last 6 months"
              action={
                <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                  <Wrench size={14} /> Completed
                </span>
              }
            />
            <div className="p-4">
              <BarChartCard data={maintMonthly} color="#d97706" />
            </div>
          </Card>
          </Link>
        )}
      </div>

      {/* lower panels */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* recent alerts */}
        {canSeeAlerts && (
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
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
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
        )}

        {/* top drivers */}
        {canSeeDrivers && (
        <Link href="/drivers">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
        </Link>
        )}
      </div>

      {/* Compliance Audit */}
      {canSeeCompliance && (complianceIssues > 0 || regExpiringSoon.length > 0 || insExpiringSoon.length > 0) && (
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

      {/* Vehicle Age Compliance */}
      {canSeeCompliance && agingVehicles.length > 0 && (
        <div className="mt-6">
          <Card className="border-orange-200">
            <CardHeader
              title="⚠️ Vehicle Age Compliance"
              subtitle={`Cargo Vans max 4 years · Box Trucks max 7 years — ${agingVehicles.filter((v) => v.overdue).length} overdue, ${agingVehicles.filter((v) => !v.overdue).length} approaching`}
            />
            <div className="max-h-72 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2 font-semibold text-slate-600">Vehicle</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Year</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Age</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Lease End</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Months Left</th>
                    <th className="px-4 py-2 font-semibold text-slate-600">Paid Off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingVehicles.map((v) => (
                    <tr key={v.id} className={v.overdue ? "bg-red-50" : "bg-orange-50/50"}>
                      <td className="px-4 py-2">
                        <Link href={`/vehicles/${v.id}`} className="font-medium text-blue-600 hover:underline">
                          {v.dxNumber ?? v.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{v.type === "VAN" ? "Cargo Van" : "Box Truck"}</td>
                      <td className="px-4 py-2 text-slate-600">{v.year}</td>
                      <td className="px-4 py-2 font-medium">{v.age} yr{v.age !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-2">
                        {v.overdue ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">OVERDUE</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">APPROACHING</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {v.leaseEndDate ? formatDate(v.leaseEndDate) : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {v.monthsToLeaseEnd !== null ? (
                          <span className={v.monthsToLeaseEnd <= 6 ? "font-bold text-red-600" : ""}>
                            {v.monthsToLeaseEnd > 0 ? `${v.monthsToLeaseEnd} mo` : "Expired"}
                          </span>
                        ) : v.monthsLeftPayoff ? `${v.monthsLeftPayoff} mo` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {v.monthsLeftPayoff === 0 || v.monthsLeftPayoff === null && !v.leaseEndDate ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">PAID OFF</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Vehicle Onboarding / Offboarding & Samsara Status */}
      {isManager && (
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
      )}

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
                  <p className="text-xs text-slate-400">{w.vehicle?.name ?? w.vehicleOther ?? "—"}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {formatDate(w.scheduledFor)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {canSeeFinance && (
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
        )}
      </div>
    </div>
  );
}
