import { prisma } from "@/lib/db";
import { Card, CardHeader, StatCard } from "@/components/ui";
import {
  BarChartCard,
  AreaChartCard,
  DonutChart,
  MultiLineChart,
} from "@/components/charts";
import { ExportButton } from "@/components/ReportsExport";
import { PageHeader } from "@/components/ui";
import { VEHICLE_STATUS, titleCase } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [vehicles, fuelLogs, workOrders, trips] = await Promise.all([
    prisma.vehicle.findMany({ include: { assignedDriver: true } }),
    prisma.fuelLog.findMany(),
    prisma.workOrder.findMany(),
    prisma.trip.findMany(),
  ]);

  const now = new Date();
  const monthLabels: string[] = [];
  const months: { y: number; m: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(d.toLocaleDateString("en-US", { month: "short" }));
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  }

  function bucket(date: Date) {
    return months.findIndex(
      (mm) => mm.y === date.getFullYear() && mm.m === date.getMonth(),
    );
  }

  // monthly cost comparison
  const fuelByMonth = new Array(6).fill(0);
  const maintByMonth = new Array(6).fill(0);
  for (const f of fuelLogs) {
    const b = bucket(new Date(f.date));
    if (b >= 0) fuelByMonth[b] += f.totalCost;
  }
  for (const w of workOrders) {
    if (w.status !== "COMPLETED" || !w.completedAt) continue;
    const b = bucket(new Date(w.completedAt));
    if (b >= 0) maintByMonth[b] += w.cost;
  }
  const costTrend = monthLabels.map((label, i) => ({
    label,
    Fuel: Math.round(fuelByMonth[i]),
    Maintenance: Math.round(maintByMonth[i]),
  }));

  // vehicles by type
  const typeCounts: Record<string, number> = {};
  for (const v of vehicles) typeCounts[v.type] = (typeCounts[v.type] ?? 0) + 1;
  const byType = Object.entries(typeCounts).map(([k, v]) => ({
    label: titleCase(k),
    value: v,
  }));

  // status donut
  const statusCounts: Record<string, number> = {};
  for (const v of vehicles)
    statusCounts[v.status] = (statusCounts[v.status] ?? 0) + 1;
  const donut = Object.keys(VEHICLE_STATUS).map((k) => ({
    name: VEHICLE_STATUS[k as keyof typeof VEHICLE_STATUS].label,
    value: statusCounts[k] ?? 0,
    color: VEHICLE_STATUS[k as keyof typeof VEHICLE_STATUS].color,
  }));

  // cost per vehicle (fuel + completed maintenance), top 10
  const costPerVehicle = vehicles
    .map((v) => {
      const fuel = fuelLogs
        .filter((f) => f.vehicleId === v.id)
        .reduce((s, f) => s + f.totalCost, 0);
      const maint = workOrders
        .filter((w) => w.vehicleId === v.id && w.status === "COMPLETED")
        .reduce((s, w) => s + w.cost, 0);
      return { name: v.name, label: v.name, value: Math.round(fuel + maint), fuel, maint };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // totals
  const totalFuel = fuelLogs.reduce((s, f) => s + f.totalCost, 0);
  const totalMaint = workOrders
    .filter((w) => w.status === "COMPLETED")
    .reduce((s, w) => s + w.cost, 0);
  const totalDistance = trips.reduce((s, t) => s + t.distanceKm, 0);
  const completedTrips = trips.filter((t) => t.status === "COMPLETED").length;

  // export rows
  const vehicleRows = vehicles.map((v) => ({
    Name: v.name,
    Make: v.make,
    Model: v.model,
    Year: v.year,
    Type: v.type,
    Status: v.status,
    Plate: v.licensePlate,
    VIN: v.vin,
    OdometerKm: Math.round(v.odometer),
    FuelLevelPct: Math.round(v.fuelLevel),
    Driver: v.assignedDriver
      ? `${v.assignedDriver.firstName} ${v.assignedDriver.lastName}`
      : "",
  }));

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Operational performance and cost insights."
        action={<ExportButton rows={vehicleRows} filename="fleet-vehicles.csv" label="Export Fleet CSV" />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Fuel Spend" value={formatCurrency(totalFuel)} accent="#0891b2" />
        <StatCard label="Total Maintenance" value={formatCurrency(totalMaint)} accent="#d97706" />
        <StatCard label="Distance Logged" value={`${formatNumber(totalDistance)} km`} accent="#2563eb" />
        <StatCard label="Completed Trips" value={completedTrips} accent="#16a34a" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Cost Trend" subtitle="Fuel vs maintenance · last 6 months" />
          <div className="p-4">
            <MultiLineChart
              data={costTrend}
              lines={[
                { key: "Fuel", color: "#0891b2", name: "Fuel" },
                { key: "Maintenance", color: "#d97706", name: "Maintenance" },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Fleet by Status" />
          <div className="p-4">
            <DonutChart data={donut} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Vehicles by Type" />
          <div className="p-4">
            <BarChartCard data={byType} color="#7c3aed" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Monthly Fuel Spend" />
          <div className="p-4">
            <AreaChartCard
              data={monthLabels.map((label, i) => ({ label, value: Math.round(fuelByMonth[i]) }))}
              color="#0891b2"
              prefix="$"
            />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader title="Top Cost Vehicles" subtitle="Fuel + completed maintenance" />
          <div className="p-4">
            <BarChartCard data={costPerVehicle} color="#dc2626" />
          </div>
        </Card>
      </div>
    </div>
  );
}
