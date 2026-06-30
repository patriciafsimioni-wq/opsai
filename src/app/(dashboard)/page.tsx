import Link from "next/link";
import {
  Truck,
  Activity,
  AlertTriangle,
  Wrench,
  Fuel,
  Users,
  TrendingUp,
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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [vehicles, drivers, trips, alerts, workOrders, fuelLogs] =
    await Promise.all([
      prisma.vehicle.findMany(),
      prisma.driver.findMany({ orderBy: { safetyScore: "desc" } }),
      prisma.trip.findMany(),
      prisma.alert.findMany({
        orderBy: { createdAt: "desc" },
        include: { vehicle: true },
        take: 6,
      }),
      prisma.workOrder.findMany({ include: { vehicle: true } }),
      prisma.fuelLog.findMany(),
    ]);

  const statusCounts = {
    ACTIVE: vehicles.filter((v) => v.status === "ACTIVE").length,
    IDLE: vehicles.filter((v) => v.status === "IDLE").length,
    MAINTENANCE: vehicles.filter((v) => v.status === "MAINTENANCE").length,
    OUT_OF_SERVICE: vehicles.filter((v) => v.status === "OUT_OF_SERVICE").length,
  };

  const unreadAlerts = await prisma.alert.count({ where: { read: false } });
  const openWO = workOrders.filter(
    (w) => w.status === "OPEN" || w.status === "SCHEDULED" || w.status === "IN_PROGRESS",
  ).length;
  const activeTripsCount = trips.filter((t) => t.status === "IN_PROGRESS").length;

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

  // trips last 7 days
  const dayLabels: string[] = [];
  const tripsPerDay: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now - i * 86400000);
    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    dayLabels.push(label);
    const count = trips.filter((t) => {
      const d = t.startedAt ?? t.scheduledStart;
      return new Date(d).toDateString() === day.toDateString();
    }).length;
    tripsPerDay.push({ label, value: count });
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
    fuelTrend.push({ label: `W${8 - i}`, value: Math.round(cost) });
  }

  const utilization =
    vehicles.length > 0
      ? Math.round((statusCounts.ACTIVE / vehicles.length) * 100)
      : 0;

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Fleet Overview</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Real-time snapshot of your entire operation.
        </p>
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
          <CardHeader title="Trips" subtitle="Last 7 days" />
          <div className="p-4">
            <BarChartCard data={tripsPerDay} color="#2563eb" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Fuel Spend"
            subtitle="Weekly trend"
            action={
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <TrendingUp size={14} /> 8 wks
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
              return (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
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
                </div>
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
              <p className="text-xs text-slate-400">Active Trips</p>
              <p className="mt-1 text-xl font-bold">{activeTripsCount}</p>
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
