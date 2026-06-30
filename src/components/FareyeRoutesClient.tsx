"use client";

import { useState, useEffect, useRef } from "react";
import { useData } from "@/lib/use-data";
import { STATION_LABEL } from "@/lib/constants";

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
};

type ByType = Record<string, { count: number; miles: number; stops: number; avgUtil: number }>;

type ApiResponse = {
  routes: FareyeRoute[];
  summary: Summary;
  byType: ByType;
  availableDates: string[];
};

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

    // Grid
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

      // Route label
      ctx.save();
      ctx.fillStyle = "#64748b";
      ctx.font = "9px system-ui";
      ctx.textAlign = "right";
      ctx.translate(x + barW / 2, pad.top + chartH + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(r.routeId, 0, 0);
      ctx.restore();
    });

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Planned Miles per Route (sorted)", w / 2, 16);
  }, [routes]);

  return <canvas ref={canvasRef} className="h-[280px] w-full" />;
}

export function FareyeRoutesClient() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [station, setStation] = useState<string>("");
  const params = new URLSearchParams();
  if (selectedDate) params.set("date", selectedDate);
  if (station) params.set("station", station);

  const { data, loading } = useData<ApiResponse>(`/api/fareye-routes?${params.toString()}`);
  const initialized = useRef(false);

  useEffect(() => {
    if (data?.availableDates && data.availableDates.length > 0 && !initialized.current) {
      initialized.current = true;
      setSelectedDate(data.availableDates[0]);
    }
  }, [data]);

  if (loading && !data) return <div className="p-8 text-center text-slate-500">Loading routes...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load routes.</div>;

  const { routes, summary, byType, availableDates } = data;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
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
            {(["IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT"] as const).map((s) => (
              <option key={s} value={s}>{STATION_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
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
      </div>

      {/* Chart + Type breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 lg:col-span-2">
          <MilesChart routes={routes} />
        </div>
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
      </div>

      {/* Routes table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="px-3 py-2 text-left font-semibold">Route</th>
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
                <td className="whitespace-nowrap px-3 py-2 font-medium text-blue-700">{r.routeId}</td>
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
                <td colSpan={13} className="px-3 py-8 text-center text-slate-400">
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
