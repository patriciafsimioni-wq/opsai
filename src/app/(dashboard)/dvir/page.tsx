"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, Badge } from "@/components/ui";
import { ClipboardCheck, AlertTriangle, Camera, CheckCircle2, XCircle, Flag } from "lucide-react";
import { apiSend } from "@/lib/use-data";
import { STATIONS as BRAND_STATIONS } from "@/lib/constants";

type Vehicle = { id: string; name: string; dxNumber: string | null; station?: string };
type DvirReport = {
  id: string;
  vehicleId: string;
  vehicle: { id: string; name: string; dxNumber: string | null; station?: string };
  submittedBy: { id: string; name: string };
  odometer: number | null;
  tires: string;
  brakes: string;
  lights: string;
  mirrors: string;
  windshield: string;
  wipers: string;
  horn: string;
  seatbelts: string;
  fluids: string;
  bodyDamage: string;
  exhaust: string;
  steering: string;
  suspension: string;
  ac: string;
  overallStatus: string;
  notes: string | null;
  photos: string | null;
  hasAlert: boolean;
  alertResolved: boolean;
  createdAt: string;
};

const INSPECTION_ITEMS = [
  { key: "tires", label: "Tires" },
  { key: "brakes", label: "Brakes" },
  { key: "lights", label: "Lights & Signals" },
  { key: "mirrors", label: "Mirrors" },
  { key: "windshield", label: "Windshield" },
  { key: "wipers", label: "Wipers" },
  { key: "horn", label: "Horn" },
  { key: "seatbelts", label: "Seatbelts" },
  { key: "fluids", label: "Fluid Levels" },
  { key: "bodyDamage", label: "Body/Exterior Damage" },
  { key: "exhaust", label: "Exhaust System" },
  { key: "steering", label: "Steering" },
  { key: "suspension", label: "Suspension" },
  { key: "ac", label: "A/C & Heating" },
] as const;

const STATIONS = ["ALL", ...BRAND_STATIONS] as const;

export default function DvirPage() {
  const [tab, setTab] = useState<"form" | "history" | "alerts">("form");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reports, setReports] = useState<DvirReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState<string>("ALL");

  // Form state
  const [vehicleId, setVehicleId] = useState("");
  const [odometer, setOdometer] = useState("");
  const [items, setItems] = useState<Record<string, string>>(
    Object.fromEntries(INSPECTION_ITEMS.map(({ key }) => [key, "PASS"]))
  );
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/vehicles").then((r) => r.json()),
      fetch("/api/dvir").then((r) => r.json()),
    ]).then(([veh, rep]) => {
      setVehicles(Array.isArray(veh) ? veh : []);
      setReports(Array.isArray(rep) ? rep : []);
      setLoading(false);
    });
  }, []);

  async function submit() {
    if (!vehicleId) return alert("Please select a vehicle");
    setSubmitting(true);
    try {
      await apiSend("/api/dvir", "POST", {
        vehicleId,
        odometer: odometer ? Number(odometer) : undefined,
        ...items,
        notes: notes || undefined,
        photos: photos.length > 0 ? JSON.stringify(photos) : undefined,
      });
      setSuccess(true);
      // Reset form
      setItems(Object.fromEntries(INSPECTION_ITEMS.map(({ key }) => [key, "PASS"])));
      setNotes("");
      setPhotos([]);
      setOdometer("");
      // Refresh reports
      const rep = await fetch("/api/dvir").then((r) => r.json());
      setReports(Array.isArray(rep) ? rep : []);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error submitting DVIR: " + String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const filteredVehicles = stationFilter === "ALL" ? vehicles : vehicles.filter((v) => v.station === stationFilter);
  const filtered = stationFilter === "ALL" ? reports : reports.filter((r) => r.vehicle.station === stationFilter);
  const alertReports = filtered.filter((r) => r.hasAlert && !r.alertResolved);
  const failedReports = filtered.filter((r) => r.overallStatus === "FAIL");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck size={24} /> DVIR — Driver Vehicle Inspection Report
          </h1>
          <p className="text-sm text-[var(--color-muted)]">Pre-trip and post-trip vehicle inspections</p>
        </div>
        <button
          onClick={() => window.open(`/issues?create=1&title=${encodeURIComponent("DVIR Issue")}&category=DVIR`, "_self")}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <Flag size={14} /> Flag Issue
        </button>
      </div>

      {/* Station Filter + Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["form", "history", "alerts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t === "form" ? "New Inspection" : t === "history" ? `History (${filtered.length})` : `Alerts (${alertReports.length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Station</label>
          <select
            value={stationFilter}
            onChange={(e) => { setStationFilter(e.target.value); setVehicleId(""); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            {STATIONS.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Stations" : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* New Inspection Form */}
      {tab === "form" && (
        <Card>
          <CardHeader title="New DVIR Inspection" subtitle="All users can submit inspections" />
          <div className="p-5 space-y-5">
            {success && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
                DVIR submitted successfully!
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Vehicle *</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select vehicle...</option>
                  {filteredVehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.dxNumber ?? v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Odometer Reading</label>
                <input
                  type="number"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  placeholder="Current mileage"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Inspection Checklist */}
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">Inspection Items</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {INSPECTION_ITEMS.map(({ key, label }) => (
                  <div key={key} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    items[key] === "FAIL" ? "border-red-300 bg-red-50" : items[key] === "NA" ? "border-slate-200 bg-slate-50" : "border-green-200 bg-green-50"
                  }`}>
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                    <div className="flex gap-1">
                      {(["PASS", "FAIL", "NA"] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setItems((prev) => ({ ...prev, [key]: status }))}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                            items[key] === status
                              ? status === "PASS" ? "bg-green-600 text-white"
                                : status === "FAIL" ? "bg-red-600 text-white"
                                : "bg-slate-500 text-white"
                              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Notes / Description of Issues</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe any damage, issues, or concerns..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                <Camera size={12} className="inline mr-1" /> Photos
              </label>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-3 py-3 text-center text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50">
                  {uploading ? "Uploading..." : "Tap to upload photo or take picture"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/uploads", { method: "POST", body: fd });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && (data as { url: string }).url) {
                        setPhotos((p) => [...p, (data as { url: string }).url]);
                      }
                      setUploading(false);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                      <button
                        onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                        className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs group-hover:flex"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={submit}
              disabled={submitting || !vehicleId}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit DVIR"}
            </button>
          </div>
        </Card>
      )}

      {/* History */}
      {tab === "history" && (
        <Card>
          <CardHeader title="Inspection History" subtitle={`${reports.length} reports`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Vehicle</th>
                  <th className="px-4 py-2">Inspector</th>
                  <th className="px-4 py-2">Odometer</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Failed Items</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const failedItems = INSPECTION_ITEMS.filter(({ key }) => (r as Record<string, unknown>)[key] === "FAIL").map(({ label }) => label);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2 font-medium">{r.vehicle.dxNumber ?? r.vehicle.name}</td>
                      <td className="px-4 py-2">{r.submittedBy.name}</td>
                      <td className="px-4 py-2">{r.odometer ? r.odometer.toLocaleString() : "—"}</td>
                      <td className="px-4 py-2">
                        {r.overallStatus === "PASS" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                            <CheckCircle2 size={10} /> PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            <XCircle size={10} /> FAIL
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-red-600">
                        {failedItems.length > 0 ? failedItems.join(", ") : "—"}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No inspections yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Alerts */}
      {tab === "alerts" && (
        <Card>
          <CardHeader title="DVIR Alerts" subtitle="Vehicles with reported damage or critical failures" />
          <div className="p-5 space-y-3">
            {alertReports.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">No active DVIR alerts</p>
            )}
            {alertReports.map((r) => {
              const failedItems = INSPECTION_ITEMS.filter(({ key }) => (r as Record<string, unknown>)[key] === "FAIL").map(({ label }) => label);
              return (
                <div key={r.id} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-600" />
                      <span className="font-semibold text-red-800">{r.vehicle.dxNumber ?? r.vehicle.name}</span>
                      <span className="text-xs text-red-600">— {failedItems.join(", ")}</span>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.notes && <p className="mt-1 text-xs text-slate-600">{r.notes}</p>}
                  <p className="mt-1 text-[10px] text-slate-500">Reported by: {r.submittedBy.name}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
