"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useData } from "@/lib/use-data";
import { STATION_LABEL } from "@/lib/constants";
import { Download } from "lucide-react";

type FareyeRoute = {
  id: string;
  date: string;
  routeId: string;
  miles: number;
  travelMinutes: number;
  routeDurationMinutes: number;
  leaveByTime: string | null;
  plannedEndTime: string | null;
  stops: number;
  totalWeight: number;
  totalPallets: number;
  vehicleType: string;
  vehicleTag: string | null;
  vehicleUtilization: number;
  sporh: number;
  plannedHours: number;
  station: string;
};

type Summary = {
  totalRoutes: number;
  totalMiles: number;
  totalStops: number;
  avgUtilization: number;
  avgSporh: number;
  totalPlannedHrs: number;
};

type GroupStats = { count: number; miles: number; stops: number; avgUtil: number };
type ByType = Record<string, GroupStats>;

type ApiResponse = {
  routes: FareyeRoute[];
  summary: Summary;
  byType: ByType;
  byStation: Record<string, GroupStats>;
  byDate: Record<string, GroupStats>;
  availableDates: string[];
  availableStations: string[];
};

type RangeMode = "day" | "week" | "month";

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function UtilBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 110);
  const width = Math.min(clamped, 100);
  const color = pct >= 95 ? "#22c55e" : pct >= 80 ? "#3b82f6" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

function MilesChart({ routes }: { routes: FareyeRoute[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || routes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 30, right: 20, bottom: 50, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const sorted = [...routes].sort((a, b) => b.miles - a.miles);
    const maxMiles = Math.max(...sorted.map((r) => r.miles)) * 1.1;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(maxMiles - (maxMiles / 5) * i) + " mi", pad.left - 6, y + 3);
    }

    const barW = Math.min(chartW / sorted.length - 2, 20);
    const gap = (chartW - barW * sorted.length) / sorted.length;

    sorted.forEach((r, i) => {
      const x = pad.left + i * (barW + gap) + gap / 2;
      const h1 = (r.miles / maxMiles) * chartH;
      const color = r.vehicleUtilization >= 90 ? "#3b82f6" : r.vehicleUtilization >= 75 ? "#60a5fa" : "#f59e0b";
      ctx.fillStyle = color;
      ctx.fillRect(x, pad.top + chartH - h1, barW, h1);

      ctx.save();
      ctx.fillStyle = "#64748b";
      ctx.font = "9px system-ui";
      ctx.textAlign = "right";
      ctx.translate(x + barW / 2, pad.top + chartH + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(r.routeId, 0, 0);
      ctx.restore();
    });

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Planned Miles per Route (sorted)", w / 2, 16);
  }, [routes]);

  return <canvas ref={canvasRef} className="h-[280px] w-full" />;
}

function DailyMilesChart({ byDate }: { byDate: Record<string, GroupStats> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const days = Object.keys(byDate).sort();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || days.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 30, right: 20, bottom: 50, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxMiles = Math.max(...days.map((d) => byDate[d].miles)) * 1.15;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      const val = maxMiles - (maxMiles / 5) * i;
      ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + "k" : Math.round(val) + " mi", pad.left - 6, y + 3);
    }

    const barW = Math.min(chartW / days.length - 4, 40);
    const gap = (chartW - barW * days.length) / (days.length + 1);

    days.forEach((d, i) => {
      const x = pad.left + gap + i * (barW + gap);
      const h1 = (byDate[d].miles / maxMiles) * chartH;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x, pad.top + chartH - h1, barW, h1);

      // Value on top
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(Math.round(byDate[d].miles).toLocaleString(), x + barW / 2, pad.top + chartH - h1 - 4);

      // Date label
      ctx.save();
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.translate(x + barW / 2, pad.top + chartH + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(d.slice(5), 0, 0);
      ctx.restore();
    });

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Total Planned Miles by Day", w / 2, 16);
  }, [byDate, days]);

  return <canvas ref={canvasRef} className="h-[280px] w-full" />;
}

function StationBreakdown({ byStation }: { byStation: Record<string, GroupStats> }) {
  const entries = Object.entries(byStation).sort((a, b) => b[1].miles - a[1].miles);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-700">By Station</h3>
      <div className="space-y-3">
        {entries.map(([st, stats]) => (
          <div key={st} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">{STATION_LABEL[st as keyof typeof STATION_LABEL] ?? st}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Routes: <span className="font-medium text-slate-700">{stats.count}</span></span>
              <span>Miles: <span className="font-medium text-slate-700">{stats.miles.toLocaleString()}</span></span>
              <span>Stops: <span className="font-medium text-slate-700">{stats.stops}</span></span>
              <span>Util: <span className="font-medium text-slate-700">{stats.avgUtil.toFixed(1)}%</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RANGE_LABELS: Record<RangeMode, string> = { day: "Day", week: "Week", month: "Month" };

export function FareyeRoutesClient() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [station, setStation] = useState<string>("");
  const [range, setRange] = useState<RangeMode>("day");

  const params = new URLSearchParams();
  if (selectedDate) params.set("date", selectedDate);
  if (station) params.set("station", station);
  params.set("range", range);

  const { data, loading } = useData<ApiResponse>(`/api/fareye-routes?${params.toString()}`);
  const initialized = useRef(false);

  const downloadMileageReport = useCallback(() => {
    if (!data || data.routes.length === 0) return;
    const periodLabel = range === "day" ? "Daily" : range === "week" ? "Weekly" : "Monthly";
    const stationLabel = station || "All_Stations";
    const dateLabel = selectedDate || "all_dates";
    const filename = `FareEye_Mileage_Report_${periodLabel}_${stationLabel}_${dateLabel}.csv`;

    const headers = [
      "Date", "Route ID", "Station", "Driver", "Vehicle Type", "Vehicle Tag",
      "Miles", "Travel Time (min)", "Route Duration (min)", "Leave By Time",
      "Planned End Time", "Stops", "Total Weight", "Total Pallets",
      "Vehicle Utilization %", "SPORH", "Planned Hours",
    ];
    const csvRows = [headers.join(",")];
    for (const r of data.routes) {
      csvRows.push([
        new Date(r.date).toISOString().slice(0, 10),
        `"${r.routeId}"`,
        r.station,
        `"${(r as Record<string, unknown>).driverName ?? ""}"`,
        `"${r.vehicleType}"`,
        `"${r.vehicleTag ?? ""}"`,
        r.miles.toFixed(1),
        r.travelMinutes,
        r.routeDurationMinutes,
        r.leaveByTime ?? "",
        r.plannedEndTime ?? "",
        r.stops,
        r.totalWeight,
        r.totalPallets,
        r.vehicleUtilization.toFixed(1),
        r.sporh.toFixed(2),
        r.plannedHours.toFixed(1),
      ].join(","));
    }

    // Summary row
    csvRows.push("");
    csvRows.push("Summary");
    csvRows.push(`Total Routes,${data.summary.totalRoutes}`);
    csvRows.push(`Total Miles,${data.summary.totalMiles.toLocaleString()}`);
    csvRows.push(`Total Stops,${data.summary.totalStops.toLocaleString()}`);
    csvRows.push(`Avg Utilization,${data.summary.avgUtilization.toFixed(1)}%`);
    csvRows.push(`Avg SPORH,${data.summary.avgSporh.toFixed(2)}`);
    csvRows.push(`Total Planned Hours,${data.summary.totalPlannedHrs.toFixed(1)}`);

    // Station breakdown
    if (Object.keys(data.byStation).length > 0) {
      csvRows.push("");
      csvRows.push("Station Breakdown");
      csvRows.push("Station,Routes,Miles,Stops,Avg Utilization %");
      for (const [st, stats] of Object.entries(data.byStation)) {
        csvRows.push(`${st},${stats.count},${stats.miles.toLocaleString()},${stats.stops},${stats.avgUtil.toFixed(1)}`);
      }
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, range, station, selectedDate]);

  useEffect(() => {
    if (data?.availableDates && data.availableDates.length > 0 && !initialized.current) {
      initialized.current = true;
      setSelectedDate(data.availableDates[0]);
    }
  }, [data]);

  if (loading && !data) return <div className="p-8 text-center text-slate-500">Loading routes...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load routes.</div>;

  const { routes, summary, byType, byStation, byDate, availableDates, availableStations } = data;
  const showDailyChart = range !== "day" && Object.keys(byDate).length > 1;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Range toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-0.5">
          {(["day", "week", "month"] as RangeMode[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                range === r ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Date</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            <option value="">All dates</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Station</label>
          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            <option value="">All stations</option>
            {availableStations.map((s) => (
              <option key={s} value={s}>{STATION_LABEL[s as keyof typeof STATION_LABEL] ?? s}</option>
            ))}
          </select>
        </div>

        <button
          onClick={downloadMileageReport}
          disabled={!data || data.routes.length === 0}
          className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={16} />
          Download Mileage Report
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Routes</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalRoutes}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Miles</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalMiles.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Stops</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalStops.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Avg Utilization</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{summary.avgUtilization.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Avg SPORH</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.avgSporh.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Planned Hrs</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalPlannedHrs.toFixed(1)}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {showDailyChart ? (
          <>
            <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 lg:col-span-2">
              <DailyMilesChart byDate={byDate} />
            </div>
            <StationBreakdown byStation={byStation} />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 lg:col-span-2">
              <MilesChart routes={routes} />
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-700">By Route Type</h3>
                <div className="space-y-3">
                  {Object.entries(byType).map(([type, stats]) => (
                    <div key={type} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">{type}</p>
                      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Routes: <span className="font-medium text-slate-700">{stats.count}</span></span>
                        <span>Miles: <span className="font-medium text-slate-700">{stats.miles.toLocaleString()}</span></span>
                        <span>Stops: <span className="font-medium text-slate-700">{stats.stops}</span></span>
                        <span>Util: <span className="font-medium text-slate-700">{stats.avgUtil.toFixed(1)}%</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {Object.keys(byStation).length > 1 && <StationBreakdown byStation={byStation} />}
            </div>
          </>
        )}
      </div>

      {/* Routes table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-700 text-white">
              {range !== "day" && <th className="px-3 py-2 text-left font-semibold">Date</th>}
              <th className="px-3 py-2 text-left font-semibold">Route</th>
              <th className="px-3 py-2 text-left font-semibold">Station</th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Tags</th>
              <th className="px-3 py-2 text-right font-semibold">Miles</th>
              <th className="px-3 py-2 text-right font-semibold">Travel</th>
              <th className="px-3 py-2 text-right font-semibold">Duration</th>
              <th className="px-3 py-2 text-center font-semibold">Leave By</th>
              <th className="px-3 py-2 text-center font-semibold">End Time</th>
              <th className="px-3 py-2 text-right font-semibold">Stops</th>
              <th className="px-3 py-2 text-right font-semibold">Pallets</th>
              <th className="px-3 py-2 text-left font-semibold">Utilization</th>
              <th className="px-3 py-2 text-right font-semibold">SPORH</th>
              <th className="px-3 py-2 text-right font-semibold">Planned Hrs</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                {range !== "day" && (
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{new Date(r.date).toISOString().slice(0, 10)}</td>
                )}
                <td className="whitespace-nowrap px-3 py-2 font-medium text-blue-700">{r.routeId}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.station}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium">{r.vehicleType}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.vehicleTag ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{r.miles.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtMins(r.travelMinutes)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtMins(r.routeDurationMinutes)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{r.leaveByTime ?? "-"}</td>
                <td className="px-3 py-2 text-center tabular-nums">{r.plannedEndTime ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{r.stops}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.totalPallets}</td>
                <td className="px-3 py-2">
                  <UtilBar pct={r.vehicleUtilization} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sporh.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.plannedHours.toFixed(1)}</td>
              </tr>
            ))}
            {routes.length === 0 && (
              <tr>
                <td colSpan={range !== "day" ? 15 : 14} className="px-3 py-8 text-center text-slate-400">
                  No routes found for selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
