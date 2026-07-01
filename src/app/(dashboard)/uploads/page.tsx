import { getSession, canManage } from "@/lib/auth";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { UploadsClient } from "@/components/UploadsClient";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default async function UploadsPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;

  // Get last updated timestamps for each category
  const [lastFuel, lastService, lastRoute, lastVehicle, lastLease, lastDriver] = await Promise.all([
    prisma.fuelLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.workOrder.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.fareyeRoute.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.vehicle.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.vehicle.findFirst({ where: { leaseEndDate: { not: null } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.driver.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const categories = [
    { name: "Fuel Reports", icon: "⛽", lastUpdated: lastFuel?.createdAt ?? null, count: await prisma.fuelLog.count() },
    { name: "Service / Work Orders", icon: "🔧", lastUpdated: lastService?.createdAt ?? null, count: await prisma.workOrder.count() },
    { name: "FareEye Routes", icon: "🗺️", lastUpdated: lastRoute?.createdAt ?? null, count: await prisma.fareyeRoute.count() },
    { name: "Fleet / Vehicles", icon: "🚛", lastUpdated: lastVehicle?.createdAt ?? null, count: await prisma.vehicle.count() },
    { name: "Lease Data", icon: "📋", lastUpdated: lastLease?.createdAt ?? null, count: await prisma.vehicle.count({ where: { leaseEndDate: { not: null } } }) },
    { name: "Drivers (Samsara)", icon: "👤", lastUpdated: lastDriver?.createdAt ?? null, count: await prisma.driver.count() },
  ];

  return (
    <div>
      <PageHeader
        title="Smart Upload"
        subtitle="Upload Excel, CSV, or PDF files — AI auto-classifies them into the correct data category."
      />

      {/* Last Updated Tracker */}
      <Card className="mb-6">
        <CardHeader title="Data Status" subtitle="Last upload date per category" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-border)]">
          {categories.map((cat) => (
            <div key={cat.name} className="bg-white p-4 flex items-center gap-3">
              <span className="text-2xl">{cat.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 truncate">{cat.name}</p>
                <p className="text-xs text-slate-400">{cat.count.toLocaleString()} records</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold ${cat.lastUpdated ? "text-green-600" : "text-slate-400"}`}>
                  {timeAgo(cat.lastUpdated)}
                </p>
                {cat.lastUpdated && (
                  <p className="text-[10px] text-slate-400">{cat.lastUpdated.toLocaleDateString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <UploadsClient canManage={manage} />
    </div>
  );
}
