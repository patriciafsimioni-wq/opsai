"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Truck,
  Fuel,
  Wrench,
  DollarSign,
  BarChart3,
  Activity,
} from "lucide-react";
import { Card, CardHeader, StatCard } from "@/components/ui";
import {
  BarChartCard,
  AreaChartCard,
  DonutChart,
  MultiLineChart,
  GroupedBarChart,
} from "@/components/charts";
import { useData } from "@/lib/use-data";
import { useFleetView } from "@/lib/use-fleet-view";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { STATION_LABEL, VEHICLE_STATUS, titleCase } from "@/lib/constants";
import { ExportButton } from "@/components/ReportsExport";

type ReportsApiResponse = {
  stations: string[];
  dateStart: string;
  dateEnd: string;
  stats: {
    totalFuel: number;
    totalMaint: number;
    totalVolume: number;
    fillUps: number;
    completedWOs: number;
    totalVehicles: number;
    activeVehicles: number;
    avgMileage: number;
    totalCost: number;
  };
  costTrend: { label: string; Fuel: number; Maintenance: number; Parts: number; Total: number }[];
  fuelTrend: { label: string; spend: number; volume: number; fillUps: number }[];
  avgPriceTrend: { label: string; value: number }[];
  turnover: {
    trend: { label: string; month: string; Onboarded: number; Offboarded: number; net: number }[];
    onboardedTotal: number;
    offboardedTotal: number;
    onboardedNoDate: number;
    offboardedNoDate: number;
    pendingOffboards: number;
  };
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  costPerVehicle: { label: string; fuel: number; maint: number; value: number }[];
  fuelStationData: { label: string; value: number }[];
  maintServiceData: { label: string; value: number }[];
  mileageDist: { label: string; value: number }[];
};

function formatDateRange(start: string, end: string, range: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (range === "week") {
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  return s.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function ReportsClient() {
  const [station, setStation] = useState("");
  const [range, setRange] = useState<"week" | "month">("month");
  const [refDate, setRefDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const fleetView = useFleetView();
  const apiUrl = `/api/reports?range=${range}&date=${refDate}${station ? `&station=${station}` : ""}&fv=${fleetView}`;
  const { data, loading } = useData<ReportsApiResponse>(apiUrl);

  function navigate(dir: -1 | 1) {
    const d = new Date(refDate + "T12:00:00");
    if (range === "week") {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
    }
    setRefDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const stats = data?.stats;
  const costTrend = data?.costTrend ?? [];
  const fuelTrend = data?.fuelTrend ?? [];
  const avgPriceTrend = data?.avgPriceTrend ?? [];
  const turnover = data?.turnover;
  const turnoverTrend = turnover?.trend ?? [];
  const costPerVehicle = data?.costPerVehicle ?? [];
  const fuelStationData = data?.fuelStationData ?? [];
  const maintServiceData = data?.maintServiceData ?? [];
  const mileageDist = data?.mileageDist ?? [];

  const statusCounts = data?.statusCounts;
  const donut = statusCounts
    ? Object.keys(VEHICLE_STATUS).map((k) => ({
        name: VEHICLE_STATUS[k as keyof typeof VEHICLE_STATUS].label,
        value: statusCounts[k] ?? 0,
        color: VEHICLE_STATUS[k as keyof typeof VEHICLE_STATUS].color,
      }))
    : [];

  const typeCounts = data?.typeCounts;
  const byType = typeCounts
    ? Object.entries(typeCounts).map(([k, v]) => ({
        label: titleCase(k),
        value: v,
      }))
    : [];

  // Compute month-over-month trends
  let fuelMoM: number | null = null;
  if (costTrend.length >= 2) {
    const curr = costTrend[costTrend.length - 1].Fuel;
    const prev = costTrend[costTrend.length - 2].Fuel;
    if (prev > 0) fuelMoM = Math.round(((curr - prev) / prev) * 100);
  }

  let maintMoM: number | null = null;
  if (costTrend.length >= 2) {
    const curr = costTrend[costTrend.length - 1].Maintenance;
    const prev = costTrend[costTrend.length - 2].Maintenance;
    if (prev > 0) maintMoM = Math.round(((curr - prev) / prev) * 100);
  }

  // Export rows
  const exportRows = costTrend.map((r) => ({
    Month: r.label,
    "Fuel Cost": r.Fuel,
    "Maintenance Cost": r.Maintenance,
    "Parts & Supplies": r.Parts,
    "Total Cost": r.Total,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Operational performance, cost insights, and fleet trends.</p>
        </div>
        <ExportButton rows={exportRows} filename="fleet-report.csv" label="Export CSV" />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm"
        >
          <option value="">All stations</option>
          {(data?.stations ?? []).map((s) => (
            <option key={s} value={s}>{STATION_LABEL[s] ?? s}</option>
          ))}
        </select>

        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setRange("week")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              range === "week"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setRange("month")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              range === "month"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Month
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[180px] text-center text-sm font-medium text-slate-700">
            {data ? formatDateRange(data.dateStart, data.dateEnd, range) : "Loading..."}
          </span>
          <button
            onClick={() => navigate(1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading reports…</p>
      ) : (
        <>
          {/* KPI Cards Row 1: Financial */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Costs"
              value={formatCurrency(stats?.totalCost ?? 0)}
              icon={<DollarSign size={18} />}
              accent="#dc2626"
            />
            <StatCard
              label="Fuel Spend"
              value={formatCurrency(stats?.totalFuel ?? 0)}
              icon={<Fuel size={18} />}
              accent="#0891b2"
              hint={fuelMoM !== null ? (
                <span className={`flex items-center gap-1 ${fuelMoM >= 0 ? "text-red-600" : "text-green-600"}`}>
                  {fuelMoM >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(fuelMoM)}% vs prev month
                </span>
              ) : undefined}
            />
            <StatCard
              label="Maintenance Spend"
              value={formatCurrency(stats?.totalMaint ?? 0)}
              icon={<Wrench size={18} />}
              accent="#d97706"
              hint={maintMoM !== null ? (
                <span className={`flex items-center gap-1 ${maintMoM >= 0 ? "text-red-600" : "text-green-600"}`}>
                  {maintMoM >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(maintMoM)}% vs prev month
                </span>
              ) : undefined}
            />
            <StatCard
              label="Fill-ups"
              value={stats?.fillUps ?? 0}
              icon={<Fuel size={18} />}
              accent="#16a34a"
            />
          </div>

          {/* KPI Cards Row 2: Fleet */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Vehicles"
              value={stats?.totalVehicles ?? 0}
              icon={<Truck size={18} />}
              accent="#2563eb"
            />
            <StatCard
              label="Active Vehicles"
              value={stats?.activeVehicles ?? 0}
              icon={<Activity size={18} />}
              accent="#16a34a"
            />
            <StatCard
              label="Avg Mileage"
              value={`${formatNumber(stats?.avgMileage ?? 0)} mi`}
              icon={<BarChart3 size={18} />}
              accent="#7c3aed"
            />
            <StatCard
              label="Work Orders"
              value={stats?.completedWOs ?? 0}
              icon={<Wrench size={18} />}
              accent="#d97706"
            />
          </div>

          {/* Cost Trend (6 months) + Fleet Status */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Cost Trend" subtitle="Fuel vs maintenance · last 6 months" />
              <div className="p-4">
                <MultiLineChart
                  data={costTrend}
                  lines={[
                    { key: "Fuel", color: "#0891b2", name: "Fuel" },
                    { key: "Maintenance", color: "#d97706", name: "Maintenance" },
                    { key: "Parts", color: "#7c3aed", name: "Parts & Supplies" },
                    { key: "Total", color: "#dc2626", name: "Total" },
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

          {/* Fleet turnover — onboarded vs offboarded per month */}
          <Card>
            <CardHeader
              title="Fleet Turnover"
              subtitle={`Vehicles onboarded vs offboarded per month · 12 months ending ${
                turnoverTrend.length ? turnoverTrend[turnoverTrend.length - 1].label : ""
              }`}
              action={
                <ExportButton
                  rows={turnoverTrend.map((r) => ({
                    Month: r.month,
                    Onboarded: r.Onboarded,
                    Offboarded: r.Offboarded,
                    Net: r.net,
                  }))}
                  filename="fleet-turnover.csv"
                  label="Download CSV"
                />
              }
            />
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <GroupedBarChart
                  data={turnoverTrend}
                  bars={[
                    { key: "Onboarded", color: "#16a34a", name: "Onboarded" },
                    { key: "Offboarded", color: "#dc2626", name: "Offboarded" },
                  ]}
                />
              </div>
              <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Month</th>
                      <th className="px-3 py-2 text-right font-medium">In</th>
                      <th className="px-3 py-2 text-right font-medium">Out</th>
                      <th className="px-3 py-2 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...turnoverTrend].reverse().map((r) => (
                      <tr key={r.month} className="border-t border-[var(--color-border)]">
                        <td className="px-3 py-1.5 text-slate-700">{r.label}</td>
                        <td className="px-3 py-1.5 text-right text-green-700">{r.Onboarded || "—"}</td>
                        <td className="px-3 py-1.5 text-right text-red-700">{r.Offboarded || "—"}</td>
                        <td
                          className={`px-3 py-1.5 text-right font-medium ${
                            r.net > 0 ? "text-green-700" : r.net < 0 ? "text-red-700" : "text-slate-400"
                          }`}
                        >
                          {r.net > 0 ? `+${r.net}` : r.net || "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[var(--color-border)] bg-slate-50 font-semibold">
                      <td className="px-3 py-2 text-slate-700">Total</td>
                      <td className="px-3 py-2 text-right text-green-700">{turnover?.onboardedTotal ?? 0}</td>
                      <td className="px-3 py-2 text-right text-red-700">{turnover?.offboardedTotal ?? 0}</td>
                      <td className="px-3 py-2 text-right">
                        {(turnover?.onboardedTotal ?? 0) - (turnover?.offboardedTotal ?? 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {turnover && (turnover.pendingOffboards > 0 || turnover.onboardedNoDate > 0 || turnover.offboardedNoDate > 0) && (
                  <div className="space-y-0.5 border-t border-[var(--color-border)] px-3 py-2 text-xs text-slate-400">
                    {turnover.pendingOffboards > 0 && (
                      <p>{turnover.pendingOffboards} offboarded, disposal still in progress</p>
                    )}
                    {(turnover.onboardedNoDate > 0 || turnover.offboardedNoDate > 0) && (
                      <p>
                        Not counted:{" "}
                        {[
                          turnover.onboardedNoDate > 0 ? `${turnover.onboardedNoDate} with no onboard date` : null,
                          turnover.offboardedNoDate > 0 ? `${turnover.offboardedNoDate} with no offboard date` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Fuel trends row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Monthly Fuel Spend" subtitle="Last 6 months" />
              <div className="p-4">
                <AreaChartCard
                  data={fuelTrend.map((f) => ({ label: f.label, value: f.spend }))}
                  color="#0891b2"
                  prefix="$"
                />
              </div>
            </Card>

            <Card>
              <CardHeader title="Avg Fuel Price / Liter" subtitle="Trend over 6 months" />
              <div className="p-4">
                <AreaChartCard data={avgPriceTrend} color="#7c3aed" prefix="$" />
              </div>
            </Card>
          </div>

          {/* Fuel by Station + Maintenance by Service */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Fuel Spend by Station" subtitle={`${range === "week" ? "This week" : "This month"}`} />
              <div className="p-4">
                <BarChartCard data={fuelStationData} color="#0891b2" />
              </div>
            </Card>

            <Card>
              <CardHeader title="Top Maintenance Services" subtitle={`By cost · ${range === "week" ? "this week" : "this month"}`} />
              <div className="p-4">
                <BarChartCard data={maintServiceData} color="#d97706" />
              </div>
            </Card>
          </div>

          {/* Vehicles by Type + Mileage Distribution */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Vehicles by Type" />
              <div className="p-4">
                <BarChartCard data={byType} color="#7c3aed" />
              </div>
            </Card>

            <Card>
              <CardHeader title="Mileage Distribution" subtitle="Fleet odometer ranges" />
              <div className="p-4">
                <BarChartCard data={mileageDist} color="#2563eb" />
              </div>
            </Card>
          </div>

          {/* Top Cost Vehicles */}
          <Card>
            <CardHeader title="Top 10 Cost Vehicles" subtitle={`Fuel + maintenance · ${range === "week" ? "this week" : "this month"}`} />
            <div className="p-4">
              <BarChartCard data={costPerVehicle} color="#dc2626" />
            </div>
          </Card>

          {/* Fill-ups Trend */}
          <Card>
            <CardHeader title="Monthly Fill-ups" subtitle="Number of fuel transactions · last 6 months" />
            <div className="p-4">
              <BarChartCard
                data={fuelTrend.map((f) => ({ label: f.label, value: f.fillUps }))}
                color="#16a34a"
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
