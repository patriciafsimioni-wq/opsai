import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { LIFECYCLE_STATUS } from "@/lib/constants";
import Link from "next/link";
import { getSession, getUserStationFilter } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FleetFinanceStationFilter } from "@/components/FleetFinanceStationFilter";
import type { Station } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function FleetFinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSession();
  if (!user) redirect("/login");

  const params = await searchParams;
  const userStations = getUserStationFilter(user);
  const selectedStation = userStations !== null ? userStations.join(",") : (typeof params.station === "string" ? params.station : "");

  const whereClause: Record<string, unknown> = {};
  if (userStations !== null) {
    whereClause.station = { in: userStations as Station[] };
  } else if (selectedStation) {
    whereClause.station = selectedStation as Station;
  }

  const vehicles = await prisma.vehicle.findMany({
    where: whereClause,
    include: {
      maintenance: { where: { status: "COMPLETED" } },
      fuelLogs: true,
    },
  });

  const now = new Date();

  // Fleet-wide aggregates
  let totalAssetValue = 0;
  let totalInvested = 0;
  let totalLeaseCommitments = 0;
  let totalMaintenanceSpend = 0;
  let totalFuelSpend = 0;
  let totalLeasePaid = 0;
  let monthlyFleetCost = 0;

  const vehicleFinancials = vehicles.map((v) => {
    const initialInvestment = (v.purchasePrice ?? 0) + (v.taxesAndFees ?? 0) + (v.brandingCost ?? 0) + (v.gpsCamerasCost ?? 0) + (v.upfittingCost ?? 0) + (v.registrationCost ?? 0) + (v.initialInsurance ?? 0);
    const maintCost = v.maintenance.reduce((s, w) => s + w.cost, 0);
    const fuelCost = v.fuelLogs.reduce((s, f) => s + f.totalCost, 0);
    const monthlyPayment = v.monthlyPayment ?? v.totalRentPerMonth ?? 0;
    const leaseMonthsPaid = v.leaseStartDate
      ? Math.max(0, Math.round((now.getTime() - new Date(v.leaseStartDate).getTime()) / (30 * 86400000)))
      : 0;
    const leasePaid = monthlyPayment * leaseMonthsPaid;
    // Months left on the lease: use the explicit payoff count when present,
    // otherwise derive it from the lease end date (Mike Albert leases carry an
    // end date but no payoff count).
    const monthsLeft =
      v.monthsLeftPayoff ??
      (v.leaseEndDate
        ? Math.max(0, Math.round((new Date(v.leaseEndDate).getTime() - now.getTime()) / (30 * 86400000)))
        : 0);
    const remainingObligation = monthlyPayment * monthsLeft;
    const lifetimeCost = initialInvestment + maintCost + fuelCost + leasePaid;
    const costPerMile = v.odometer > 0 ? lifetimeCost / v.odometer : 0;

    totalAssetValue += v.currentMarketValue ?? v.currentBookValue ?? 0;
    totalInvested += lifetimeCost;
    totalLeaseCommitments += remainingObligation;
    totalMaintenanceSpend += maintCost;
    totalFuelSpend += fuelCost;
    totalLeasePaid += leasePaid;
    monthlyFleetCost += monthlyPayment;

    // Replacement score
    const ageYears = now.getFullYear() - (v.year ?? now.getFullYear());
    const maxAge = v.type === "VAN" ? 4 : 7;
    const ageScore = Math.min(100, (ageYears / maxAge) * 100);
    const mileageScore = v.odometer > 0 ? Math.min(100, (v.odometer / 250000) * 100) : Math.min(100, (ageYears * 25000 / 250000) * 100);
    const breakdownCount = v.maintenance.filter((w) => w.type === "REPAIR").length;
    const breakdownScore = Math.min(100, breakdownCount * 10);
    const estimatedCPM = costPerMile > 0 ? costPerMile : (lifetimeCost > 0 && ageYears > 0 ? lifetimeCost / (ageYears * 25000) : 0);
    const costTrend = estimatedCPM > 1.5 ? 100 : estimatedCPM > 1.0 ? 70 : estimatedCPM > 0.5 ? 40 : 20;
    const score = Math.round(100 - (ageScore * 0.3 + mileageScore * 0.25 + breakdownScore * 0.25 + costTrend * 0.2));
    const grade = score >= 70 ? "HEALTHY" : score >= 50 ? "MONITOR" : score >= 30 ? "PLAN_REPLACEMENT" : "REPLACE_NOW";

    return {
      id: v.id,
      name: v.name,
      dxNumber: v.dxNumber,
      type: v.type,
      year: v.year,
      odometer: v.odometer,
      station: v.station,
      lifecycleStatus: v.lifecycleStatus ?? "ACTIVE",
      paidOff: v.paidOff,
      leasingCompany: v.leasingCompany,
      monthlyPayment,
      lifetimeCost,
      costPerMile,
      maintCost,
      fuelCost,
      leasePaid,
      remainingObligation,
      score,
      grade,
      leaseEndDate: v.leaseEndDate,
      monthsLeftPayoff: monthsLeft,
    };
  });

  const avgCostPerVehicle = vehicles.length > 0 ? totalInvested / vehicles.length : 0;

  // Upcoming lease expirations
  const leaseExpiring30 = vehicleFinancials.filter((v) => v.leaseEndDate && v.monthsLeftPayoff != null && v.monthsLeftPayoff <= 1 && v.monthsLeftPayoff >= 0).length;
  const leaseExpiring60 = vehicleFinancials.filter((v) => v.leaseEndDate && v.monthsLeftPayoff != null && v.monthsLeftPayoff <= 2 && v.monthsLeftPayoff >= 0).length;
  const leaseExpiring90 = vehicleFinancials.filter((v) => v.leaseEndDate && v.monthsLeftPayoff != null && v.monthsLeftPayoff <= 3 && v.monthsLeftPayoff >= 0).length;

  // Vehicles costing more than average
  const highCostVehicles = vehicleFinancials.filter((v) => v.costPerMile > 1.0 && v.odometer > 10000).sort((a, b) => b.costPerMile - a.costPerMile).slice(0, 10);

  // Fleet health distribution
  const healthyCount = vehicleFinancials.filter((v) => v.grade === "HEALTHY").length;
  const monitorCount = vehicleFinancials.filter((v) => v.grade === "MONITOR").length;
  const planCount = vehicleFinancials.filter((v) => v.grade === "PLAN_REPLACEMENT").length;
  const replaceCount = vehicleFinancials.filter((v) => v.grade === "REPLACE_NOW").length;

  // Replacement budget forecast (vehicles needing replacement * avg vehicle cost)
  const avgVehicleCost = 45000;
  const replace12 = vehicleFinancials.filter((v) => v.grade === "REPLACE_NOW").length * avgVehicleCost;
  const replace24 = (replaceCount + planCount) * avgVehicleCost;
  const replace36 = (replaceCount + planCount + Math.round(monitorCount * 0.3)) * avgVehicleCost;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executive Fleet Finance</h1>
          <p className="text-sm text-[var(--color-muted)]">Complete financial overview and decision support</p>
        </div>
        {!userStations && <FleetFinanceStationFilter current={selectedStation} />}
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="Total Fleet Asset Value" value={formatCurrency(totalAssetValue)} />
        <KpiCard label="Total Amount Invested" value={formatCurrency(totalInvested)} />
        <KpiCard label="Total Lease Commitments" value={formatCurrency(totalLeaseCommitments)} />
        <KpiCard label="Total Maintenance Spend" value={formatCurrency(totalMaintenanceSpend)} />
        <KpiCard label="Monthly Fleet Operating Cost" value={formatCurrency(monthlyFleetCost)} />
        <KpiCard label="Avg Cost per Vehicle" value={formatCurrency(avgCostPerVehicle)} />
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader title="Total Cost of Ownership" />
          <div className="space-y-3 p-5">
            <CostRow label="Maintenance" value={totalMaintenanceSpend} total={totalInvested} color="bg-amber-500" />
            <CostRow label="Fuel" value={totalFuelSpend} total={totalInvested} color="bg-green-500" />
            <CostRow label="Leasing" value={totalLeasePaid} total={totalInvested} color="bg-blue-500" />
            <div className="border-t border-slate-200 pt-2">
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totalInvested)}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Fleet Health Distribution" />
          <div className="space-y-3 p-5">
            <HealthRow label="Healthy (70-100)" count={healthyCount} total={vehicles.length} color="bg-green-500" textColor="text-green-700" />
            <HealthRow label="Monitor (50-69)" count={monitorCount} total={vehicles.length} color="bg-yellow-500" textColor="text-yellow-700" />
            <HealthRow label="Plan Replacement (30-49)" count={planCount} total={vehicles.length} color="bg-orange-500" textColor="text-orange-700" />
            <HealthRow label="Replace Now (0-29)" count={replaceCount} total={vehicles.length} color="bg-red-500" textColor="text-red-700" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Replacement Budget Forecast" />
          <div className="space-y-4 p-5">
            <div>
              <p className="text-xs text-slate-400">Next 12 Months</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(replace12)}</p>
              <p className="text-[10px] text-slate-500">{replaceCount} vehicles</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Next 24 Months</p>
              <p className="text-xl font-bold text-orange-700">{formatCurrency(replace24)}</p>
              <p className="text-[10px] text-slate-500">{replaceCount + planCount} vehicles</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Next 36 Months</p>
              <p className="text-xl font-bold text-slate-700">{formatCurrency(replace36)}</p>
              <p className="text-[10px] text-slate-500">{replaceCount + planCount + Math.round(monitorCount * 0.3)} vehicles</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Lease Expirations */}
      <Card>
        <CardHeader title="Upcoming Lease Expirations" />
        <div className="flex gap-6 p-5">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-red-700">{leaseExpiring30}</p>
            <p className="text-xs text-red-600">Within 30 Days</p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-orange-700">{leaseExpiring60}</p>
            <p className="text-xs text-orange-600">Within 60 Days</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{leaseExpiring90}</p>
            <p className="text-xs text-yellow-600">Within 90 Days</p>
          </div>
        </div>
      </Card>

      {/* Vehicles Costing More Than Expected */}
      {highCostVehicles.length > 0 && (
        <Card>
          <CardHeader title="Vehicles Costing More Than Expected" subtitle="Cost per mile > $1.00" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-5 py-2">Vehicle</th>
                  <th className="px-5 py-2">Station</th>
                  <th className="px-5 py-2">Mileage</th>
                  <th className="px-5 py-2">Cost/Mile</th>
                  <th className="px-5 py-2">Total Cost</th>
                  <th className="px-5 py-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {highCostVehicles.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="px-5 py-2">
                      <Link href={`/vehicles/${v.id}`} className="font-medium text-blue-600 hover:underline">
                        {v.dxNumber ?? v.name}
                      </Link>
                    </td>
                    <td className="px-5 py-2">{v.station}</td>
                    <td className="px-5 py-2">{formatNumber(v.odometer)} mi</td>
                    <td className="px-5 py-2 font-semibold text-red-600">{formatCurrency(v.costPerMile)}/mi</td>
                    <td className="px-5 py-2">{formatCurrency(v.lifetimeCost)}</td>
                    <td className="px-5 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        v.grade === "HEALTHY" ? "bg-green-100 text-green-700"
                        : v.grade === "MONITOR" ? "bg-yellow-100 text-yellow-700"
                        : v.grade === "PLAN_REPLACEMENT" ? "bg-orange-100 text-orange-700"
                        : "bg-red-100 text-red-700"
                      }`}>
                        {v.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* All Vehicles Financial Table */}
      <Card>
        <CardHeader title="Vehicle Financial Summary" subtitle={`${vehicles.length} vehicles`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2">Vehicle</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Lifecycle</th>
                <th className="px-4 py-2">Mileage</th>
                <th className="px-4 py-2">Monthly</th>
                <th className="px-4 py-2">Maintenance</th>
                <th className="px-4 py-2">Fuel</th>
                <th className="px-4 py-2">Total Cost</th>
                <th className="px-4 py-2">$/Mile</th>
                <th className="px-4 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {vehicleFinancials.sort((a, b) => b.lifetimeCost - a.lifetimeCost).slice(0, 50).map((v) => {
                const lc = LIFECYCLE_STATUS[v.lifecycleStatus as keyof typeof LIFECYCLE_STATUS] ?? LIFECYCLE_STATUS.ACTIVE;
                return (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/vehicles/${v.id}`} className="font-medium text-blue-600 hover:underline">
                        {v.dxNumber ?? v.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs">{v.type}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: lc.bg, color: lc.fg }}>{lc.label}</span>
                    </td>
                    <td className="px-4 py-2">{formatNumber(v.odometer)}</td>
                    <td className="px-4 py-2">{v.monthlyPayment > 0 ? formatCurrency(v.monthlyPayment) : "—"}</td>
                    <td className="px-4 py-2">{formatCurrency(v.maintCost)}</td>
                    <td className="px-4 py-2">{formatCurrency(v.fuelCost)}</td>
                    <td className="px-4 py-2 font-medium">{formatCurrency(v.lifetimeCost)}</td>
                    <td className="px-4 py-2">{v.odometer > 0 ? formatCurrency(v.costPerMile) : "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                        v.grade === "HEALTHY" ? "bg-green-100 text-green-700"
                        : v.grade === "MONITOR" ? "bg-yellow-100 text-yellow-700"
                        : v.grade === "PLAN_REPLACEMENT" ? "bg-orange-100 text-orange-700"
                        : "bg-red-100 text-red-700"
                      }`}>{v.score}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}

function CostRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">{formatCurrency(value)}</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function HealthRow({ label, count, total, color, textColor }: { label: string; count: number; total: number; color: string; textColor: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className={`font-medium ${textColor}`}>{label}</span>
        <span className="font-medium">{count} ({Math.round(pct)}%)</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
