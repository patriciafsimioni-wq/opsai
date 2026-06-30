"use client";

import { useState } from "react";
import { useData } from "@/lib/use-data";
import { AlertTriangle } from "lucide-react";

const STATIONS = ["ALL", "IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT"];

type ServiceStatus = {
  service: string;
  interval: number;
  firstDue: number;
  lastPerformedAt: number | null;
  lastPerformedDate: string | null;
  nextDue: number;
  milesUntil: number;
  status: "overdue" | "upcoming" | "on_track" | "never_performed";
};

type TimeServiceStatus = {
  service: string;
  intervalMonths: number;
  lastPerformedDate: string | null;
  nextDueDate: string | null;
  daysUntil: number | null;
  status: "overdue" | "upcoming" | "on_track" | "never_performed";
};

type VehicleSchedule = {
  id: string;
  name: string;
  dxNumber: string | null;
  station: string;
  odometer: number;
  type: string;
  year: number;
  make: string;
  model: string;
  onboardedDate: string | null;
  overdueCount: number;
  upcomingCount: number;
  neverPerformedCount: number;
  alertCount: number;
  nextService: ServiceStatus | null;
  mileageServices: ServiceStatus[];
  timeServices: TimeServiceStatus[];
};

type ScheduleData = {
  totalVehicles: number;
  vehiclesWithAlerts: number;
  vehiclesOverdue: number;
  vehiclesUpcoming: number;
  vehiclesNeverPerformed: number;
  totalAlerts: number;
  totalOverdueServices: number;
  totalUpcomingServices: number;
  totalNeverPerformed: number;
  vehicles: VehicleSchedule[];
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  never_performed: { bg: "bg-red-100", text: "text-red-700", label: "Never Performed" },
  overdue: { bg: "bg-orange-100", text: "text-orange-700", label: "Overdue" },
  upcoming: { bg: "bg-amber-100", text: "text-amber-700", label: "Upcoming" },
  on_track: { bg: "bg-green-100", text: "text-green-700", label: "On Track" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.on_track;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function VehicleDetail({ vehicle, onClose }: { vehicle: VehicleSchedule; onClose: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const services = showAll
    ? vehicle.mileageServices
    : vehicle.mileageServices.filter((s) => s.status !== "on_track");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{vehicle.dxNumber ?? vehicle.name}</h2>
            <p className="text-sm text-slate-500">
              {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.station} — {vehicle.odometer.toLocaleString()} mi
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100">Close</button>
        </div>

        {/* Summary badges */}
        <div className="flex gap-3 border-b border-slate-200 px-5 py-3">
          {vehicle.neverPerformedCount > 0 && (
            <span className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
              <AlertTriangle size={14} /> {vehicle.neverPerformedCount} Never Performed
            </span>
          )}
          {vehicle.overdueCount > 0 && (
            <span className="rounded-lg bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">
              {vehicle.overdueCount} Overdue
            </span>
          )}
          {vehicle.upcomingCount > 0 && (
            <span className="rounded-lg bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
              {vehicle.upcomingCount} Upcoming
            </span>
          )}
        </div>

        {/* Time-based services */}
        {vehicle.timeServices.length > 0 && (
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="mb-2 text-xs font-bold uppercase text-slate-400">Time-Based Services</h3>
            {vehicle.timeServices.map((ts, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <StatusBadge status={ts.status} />
                  <span className="text-sm font-medium text-slate-800">{ts.service}</span>
                  <span className="text-xs text-slate-400">Every {ts.intervalMonths} months</span>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {ts.lastPerformedDate && <span className="mr-3">Last: {ts.lastPerformedDate}</span>}
                  {ts.nextDueDate ? `Due: ${ts.nextDueDate}` : "—"}
                  {ts.daysUntil !== null && ` (${ts.daysUntil > 0 ? `in ${ts.daysUntil}d` : `${Math.abs(ts.daysUntil)}d ago`})`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mileage-based services */}
        <div className="px-5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-slate-400">
              Mileage-Based Services {!showAll && "(Alerts + Upcoming Only)"}
            </h3>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {showAll ? "Show Active Only" : "Show Full Schedule"}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2 text-right">Interval</th>
                  <th className="px-3 py-2 text-right">Last Done At</th>
                  <th className="px-3 py-2 text-right">Next Due At</th>
                  <th className="px-3 py-2 text-right">Miles Until</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={`${s.service}-${s.nextDue}-${i}`} className={`border-b border-slate-100 hover:bg-slate-50 ${s.status === "never_performed" ? "bg-red-50/50" : ""}`}>
                    <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2 font-medium text-slate-700">{s.service}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-400">Every {s.interval.toLocaleString()} mi</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {s.lastPerformedAt != null ? (
                        <div>
                          <span className="font-medium">{s.lastPerformedAt.toLocaleString()} mi</span>
                          {s.lastPerformedDate && <span className="block text-[10px] text-slate-400">{s.lastPerformedDate}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-300">Never</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{s.nextDue.toLocaleString()} mi</td>
                    <td className={`px-3 py-2 text-right font-medium ${s.milesUntil < 0 ? "text-red-600" : s.milesUntil <= 2000 ? "text-amber-600" : "text-slate-500"}`}>
                      {s.milesUntil > 0 ? `${s.milesUntil.toLocaleString()} mi` : `${Math.abs(s.milesUntil).toLocaleString()} mi past`}
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400">All services on track</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MaintenanceScheduleClient() {
  const [station, setStation] = useState("ALL");
  const { data, loading } = useData<ScheduleData>(`/api/maintenance-schedule?station=${station}`);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSchedule | null>(null);
  const [filter, setFilter] = useState<"all" | "alerts" | "overdue" | "upcoming" | "never_performed">("all");

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-400">Loading schedule...</div>;
  if (!data) return null;

  const filteredVehicles = data.vehicles.filter((v) => {
    if (filter === "alerts") return v.alertCount > 0;
    if (filter === "overdue") return v.overdueCount > 0;
    if (filter === "upcoming") return v.upcomingCount > 0;
    if (filter === "never_performed") return v.neverPerformedCount > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Schedule</h1>
          <p className="text-sm text-slate-500">Vehicle lifecycle PM schedule — next service based on last completed mileage + interval</p>
        </div>
        <select
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          {STATIONS.map((s) => (
            <option key={s} value={s}>{s === "ALL" ? "All Stations" : s}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Vehicles</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{data.totalVehicles}</p>
        </div>
        <button
          onClick={() => setFilter(filter === "alerts" ? "all" : "alerts")}
          className={`rounded-xl border p-4 text-left transition-colors ${filter === "alerts" ? "border-red-300 bg-red-50" : "border-[var(--color-border)] bg-white"}`}
        >
          <p className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle size={12} /> Alerts</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{data.vehiclesWithAlerts}</p>
          <p className="text-xs text-red-500">{data.totalAlerts} services</p>
        </button>
        <button
          onClick={() => setFilter(filter === "never_performed" ? "all" : "never_performed")}
          className={`rounded-xl border p-4 text-left transition-colors ${filter === "never_performed" ? "border-red-300 bg-red-50" : "border-[var(--color-border)] bg-white"}`}
        >
          <p className="text-xs font-medium text-red-600">Never Performed</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{data.vehiclesNeverPerformed}</p>
          <p className="text-xs text-red-500">{data.totalNeverPerformed} services</p>
        </button>
        <button
          onClick={() => setFilter(filter === "overdue" ? "all" : "overdue")}
          className={`rounded-xl border p-4 text-left transition-colors ${filter === "overdue" ? "border-orange-300 bg-orange-50" : "border-[var(--color-border)] bg-white"}`}
        >
          <p className="text-xs font-medium text-orange-600">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-orange-700">{data.vehiclesOverdue}</p>
          <p className="text-xs text-orange-500">{data.totalOverdueServices} services</p>
        </button>
        <button
          onClick={() => setFilter(filter === "upcoming" ? "all" : "upcoming")}
          className={`rounded-xl border p-4 text-left transition-colors ${filter === "upcoming" ? "border-amber-300 bg-amber-50" : "border-[var(--color-border)] bg-white"}`}
        >
          <p className="text-xs font-medium text-amber-600">Due Soon</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{data.vehiclesUpcoming}</p>
          <p className="text-xs text-amber-500">{data.totalUpcomingServices} services</p>
        </button>
      </div>

      {/* Vehicle list */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Station</th>
              <th className="px-4 py-3 text-right">Odometer</th>
              <th className="px-4 py-3">Next Service</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Miles Until</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((v) => (
              <tr key={v.id} className={`border-b border-slate-100 hover:bg-slate-50 ${v.neverPerformedCount > 0 ? "bg-red-50/30" : ""}`}>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{v.dxNumber ?? v.name}</p>
                    <p className="text-xs text-slate-400">{v.year} {v.make} {v.model}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{v.station}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-700">{v.odometer.toLocaleString()} mi</td>
                <td className="px-4 py-3 text-slate-700">
                  {v.nextService ? (
                    <div>
                      <p className="text-sm">{v.nextService.service}</p>
                      {v.nextService.lastPerformedAt != null && (
                        <p className="text-[10px] text-slate-400">Last: {v.nextService.lastPerformedAt.toLocaleString()} mi</p>
                      )}
                    </div>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {v.neverPerformedCount > 0 ? (
                    <span className="flex items-center justify-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      <AlertTriangle size={10} /> {v.neverPerformedCount} alert{v.neverPerformedCount > 1 ? "s" : ""}
                    </span>
                  ) : v.overdueCount > 0 ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">{v.overdueCount} overdue</span>
                  ) : v.upcomingCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{v.upcomingCount} upcoming</span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">On track</span>
                  )}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${v.nextService ? (v.nextService.milesUntil < 0 ? "text-red-600" : v.nextService.milesUntil <= 2000 ? "text-amber-600" : "text-slate-500") : "text-slate-400"}`}>
                  {v.nextService ? (
                    v.nextService.milesUntil > 0
                      ? `${v.nextService.milesUntil.toLocaleString()} mi`
                      : `${Math.abs(v.nextService.milesUntil).toLocaleString()} mi past`
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedVehicle(v)}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    View Schedule
                  </button>
                </td>
              </tr>
            ))}
            {filteredVehicles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No vehicles match the current filter</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedVehicle && (
        <VehicleDetail vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
      )}
    </div>
  );
}
