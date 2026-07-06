"use client";

import { useState } from "react";
import { useData, apiSend } from "@/lib/use-data";
import { AlertTriangle, Check, SkipForward, Undo2, UserPlus } from "lucide-react";

const STATIONS = ["ALL", "IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT"];

type ServiceStatus = {
  service: string;
  interval: number;
  firstDue: number;
  lastPerformedAt: number | null;
  lastPerformedDate: string | null;
  nextDue: number;
  milesUntil: number;
  status: "overdue" | "upcoming" | "on_track" | "never_performed" | "dismissed";
  dismissedAction: string | null;
  dismissedNote: string | null;
};

type TimeServiceStatus = {
  service: string;
  intervalMonths: number;
  lastPerformedDate: string | null;
  nextDueDate: string | null;
  daysUntil: number | null;
  status: "overdue" | "upcoming" | "on_track" | "never_performed" | "dismissed";
  dismissedAction: string | null;
  dismissedNote: string | null;
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
  dismissedCount: number;
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
  dismissed: { bg: "bg-slate-100", text: "text-slate-500", label: "Dismissed" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.on_track;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function VehicleDetail({ vehicle, onClose, onDismiss, onUndismiss }: {
  vehicle: VehicleSchedule;
  onClose: () => void;
  onDismiss: (vehicleId: string, service: string, action: "done" | "skip" | "assigned", note?: string) => void;
  onUndismiss: (vehicleId: string, service: string) => void;
}) {
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
          {vehicle.dismissedCount > 0 && (
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
              {vehicle.dismissedCount} Dismissed
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
                <div className="flex items-center gap-2">
                  <span className="text-right text-xs text-slate-500">
                    {ts.lastPerformedDate && <span className="mr-3">Last: {ts.lastPerformedDate}</span>}
                    {ts.nextDueDate ? `Due: ${ts.nextDueDate}` : "—"}
                    {ts.daysUntil !== null && ` (${ts.daysUntil > 0 ? `in ${ts.daysUntil}d` : `${Math.abs(ts.daysUntil)}d ago`})`}
                  </span>
                  {(ts.status === "never_performed" || ts.status === "overdue") && (
                    <div className="flex gap-1">
                      <AssignButton vehicleId={vehicle.id} vehicleName={vehicle.dxNumber ?? vehicle.name} service={ts.service} station={vehicle.station} onAssigned={(name) => { onDismiss(vehicle.id, ts.service, "assigned", name); }} />
                      <button onClick={() => onDismiss(vehicle.id, ts.service, "done")} className="rounded px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-50" title="Mark as done"><Check size={12} /> Done</button>
                      <button onClick={() => onDismiss(vehicle.id, ts.service, "skip")} className="rounded px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100" title="Skip"><SkipForward size={12} /> Skip</button>
                    </div>
                  )}
                  {ts.status === "dismissed" && (
                    <button onClick={() => onUndismiss(vehicle.id, ts.service)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50" title="Undo dismiss"><Undo2 size={12} /> Undo</button>
                  )}
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
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={`${s.service}-${s.nextDue}-${i}`} className={`border-b border-slate-100 hover:bg-slate-50 ${s.status === "never_performed" ? "bg-red-50/50" : s.status === "dismissed" ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {s.service}
                      {s.status === "dismissed" && s.dismissedAction && (
                        <span className="ml-1 text-[10px] text-slate-400">({s.dismissedAction}{s.dismissedNote ? `: ${s.dismissedNote}` : ""})</span>
                      )}
                    </td>
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
                    <td className={`px-3 py-2 text-right font-medium ${s.status === "dismissed" ? "text-slate-400" : s.milesUntil < 0 ? "text-red-600" : s.milesUntil <= 2000 ? "text-amber-600" : "text-slate-500"}`}>
                      {s.milesUntil > 0 ? `${s.milesUntil.toLocaleString()} mi` : `${Math.abs(s.milesUntil).toLocaleString()} mi past`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(s.status === "never_performed" || s.status === "overdue" || s.status === "upcoming") && (
                        <div className="flex justify-end gap-1">
                          <AssignButton vehicleId={vehicle.id} vehicleName={vehicle.dxNumber ?? vehicle.name} service={s.service} station={vehicle.station} onAssigned={(name) => { onDismiss(vehicle.id, s.service, "assigned", name); }} />
                          <button onClick={() => onDismiss(vehicle.id, s.service, "done")} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-green-700 hover:bg-green-50" title="Mark as done"><Check size={11} /></button>
                          <button onClick={() => onDismiss(vehicle.id, s.service, "skip")} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100" title="Skip this service"><SkipForward size={11} /></button>
                        </div>
                      )}
                      {s.status === "dismissed" && (
                        <button onClick={() => onUndismiss(vehicle.id, s.service)} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50" title="Undo dismiss"><Undo2 size={11} /></button>
                      )}
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-400">All services on track</td>
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

type UserOption = { id: string; name: string; role: string };

function AssignButton({ vehicleId, vehicleName, service, station, onAssigned }: {
  vehicleId: string;
  vehicleName: string;
  service: string;
  station: string;
  onAssigned: (assigneeName: string) => void;
}) {
  const [show, setShow] = useState(false);
  const { data: users } = useData<UserOption[]>("/api/users");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  const assignableUsers = (users ?? []).filter(
    (u) => u.role === "VENDOR" || u.role === "MECHANIC" || u.role === "FLEET_MANAGER" || u.role === "STATION_MANAGER"
  );

  async function assign() {
    if (!assigneeId) return;
    setSaving(true);
    const assignee = assignableUsers.find((u) => u.id === assigneeId);
    await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        title: `PM: ${service}`,
        description: `Scheduled maintenance — ${service} for ${vehicleName}`,
        type: "SCHEDULED_SERVICE",
        priority: "MEDIUM",
        status: "SCHEDULED",
        station,
        performedBy: assignee?.name ?? "",
        vendor: assignee?.name,
        assignedToId: assigneeId,
      }),
    });
    setSaving(false);
    setShow(false);
    onAssigned(assignee?.name ?? "");
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShow(true); }}
        className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
        title="Assign to vendor/mechanic"
      >
        <UserPlus size={11} />
      </button>
      {show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg p-5 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold mb-1">Assign Maintenance</p>
            <p className="text-xs text-slate-500 mb-3">{service} — {vehicleName}</p>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assign to</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3"
            >
              <option value="">Select vendor or mechanic...</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={assign}
                disabled={saving || !assigneeId}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Work Order"}
              </button>
              <button onClick={() => setShow(false)} className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MaintenanceScheduleClient() {
  const [station, setStation] = useState("ALL");
  const { data, loading, reload } = useData<ScheduleData>(`/api/maintenance-schedule?station=${station}`);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSchedule | null>(null);
  const [filter, setFilter] = useState<"all" | "alerts" | "overdue" | "upcoming" | "never_performed">("all");

  async function handleDismiss(vehicleId: string, service: string, action: "done" | "skip" | "assigned", note?: string) {
    const res = await apiSend("/api/maintenance-schedule/dismiss", "POST", { vehicleId, service, action, note: note ?? null });
    if (res.ok) {
      reload();
      setSelectedVehicle(null);
    }
  }

  async function handleUndismiss(vehicleId: string, service: string) {
    const res = await apiSend(`/api/maintenance-schedule/dismiss?vehicleId=${vehicleId}&service=${encodeURIComponent(service)}`, "DELETE");
    if (res.ok) {
      reload();
      setSelectedVehicle(null);
    }
  }

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
        <VehicleDetail
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          onDismiss={handleDismiss}
          onUndismiss={handleUndismiss}
        />
      )}
    </div>
  );
}
