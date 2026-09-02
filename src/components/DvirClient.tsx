"use client";

import { Fragment, useState, useEffect } from "react";
import { Card, CardHeader, Badge } from "@/components/ui";
import { ClipboardCheck, AlertTriangle, Camera, CheckCircle2, XCircle, Flag, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { apiSend } from "@/lib/use-data";
import { STATIONS as BRAND_STATIONS } from "@/lib/constants";
import { compressImage } from "@/lib/image";

type Vehicle = { id: string; name: string; dxNumber: string | null; station?: string };
type DvirRepair = {
  id: string;
  item: string;
  description: string;
  cost: number;
  fixedAt: string;
  vendor: string | null;
  invoiceNumber: string | null;
  photos: string | null;
  recordedBy: { id: string; name: string } | null;
};
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
  repairs: DvirRepair[];
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

const ITEM_LABEL: Record<string, string> = Object.fromEntries(
  INSPECTION_ITEMS.map(({ key, label }) => [key, label]),
);

function failedItemKeys(r: DvirReport): string[] {
  return INSPECTION_ITEMS.filter(({ key }) => (r as unknown as Record<string, unknown>)[key] === "FAIL").map(({ key }) => key);
}

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

/**
 * Per-item repair tracking for a failed inspection: each failed item is either
 * still open or shows how it was fixed, for how much, and when.
 */
function FailedItemsPanel({
  report,
  canManage,
  onRecord,
  onDelete,
}: {
  report: DvirReport;
  canManage: boolean;
  onRecord: (report: DvirReport, item: string, existing?: DvirRepair) => void;
  onDelete: (repair: DvirRepair) => void;
}) {
  const failed = failedItemKeys(report);
  if (failed.length === 0) return <p className="text-xs text-slate-500">No failed items on this inspection.</p>;

  return (
    <div className="space-y-2">
      {failed.map((key) => {
        const repair = report.repairs.find((rp) => rp.item === key);
        return (
          <div
            key={key}
            className={`rounded-lg border px-3 py-2 ${repair ? "border-green-200 bg-green-50" : "border-red-200 bg-white"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                {repair ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-600" />}
                {ITEM_LABEL[key] ?? key}
                {repair ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">FIXED</span>
                ) : (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">OPEN</span>
                )}
              </span>
              {canManage && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onRecord(report, key, repair)}
                    className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <Wrench size={12} /> {repair ? "Edit fix" : "Mark fixed"}
                  </button>
                  {repair && (
                    <button onClick={() => onDelete(repair)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
            {repair && (
              <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                <p>{repair.description}</p>
                <p className="text-slate-500">
                  {money(repair.cost)} · {new Date(repair.fixedAt).toLocaleDateString()}
                  {repair.vendor ? ` · ${repair.vendor}` : ""}
                  {repair.invoiceNumber ? ` · Inv ${repair.invoiceNumber}` : ""}
                  {repair.recordedBy ? ` · logged by ${repair.recordedBy.name}` : ""}
                </p>
                {repair.photos && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(JSON.parse(repair.photos) as string[]).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Repair ${i + 1}`} className="h-12 w-12 rounded border border-slate-200 object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Records how a failed inspection item was fixed, for how much, and when. */
function RepairModal({
  report,
  item,
  existing,
  onClose,
  onSaved,
}: {
  report: DvirReport;
  item: string;
  existing?: DvirRepair;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(existing?.description ?? "");
  const [cost, setCost] = useState(existing ? String(existing.cost) : "");
  const [fixedAt, setFixedAt] = useState(
    (existing?.fixedAt ?? new Date().toISOString()).slice(0, 10),
  );
  const [vendor, setVendor] = useState(existing?.vendor ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(existing?.invoiceNumber ?? "");
  const [photos, setPhotos] = useState<string[]>(existing?.photos ? (JSON.parse(existing.photos) as string[]) : []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!description.trim()) return alert("Describe how it was fixed");
    setSaving(true);
    try {
      await apiSend("/api/dvir/repairs", "POST", {
        reportId: report.id,
        item,
        description,
        cost: cost ? Number(cost) : 0,
        fixedAt,
        vendor: vendor || undefined,
        invoiceNumber: invoiceNumber || undefined,
        photos: photos.length > 0 ? JSON.stringify(photos) : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert("Error saving repair: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {existing ? "Edit repair" : "Mark fixed"} — {ITEM_LABEL[item] ?? item}
          </h3>
          <p className="text-xs text-slate-500">
            {report.vehicle.dxNumber ?? report.vehicle.name} · inspection {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">How it was fixed *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Replaced both front brake pads and rotors"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Date fixed *</label>
              <input
                type="date"
                value={fixedAt}
                onChange={(e) => setFixedAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Vendor / who fixed it</label>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Shop or technician"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Invoice #</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              <Camera size={12} className="inline mr-1" /> Invoice / photo
            </label>
            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-3 py-3 text-center text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50">
              {uploading ? "Uploading..." : "Upload invoice or repair photo"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const fd = new FormData();
                  fd.append("file", file.type.startsWith("image/") ? await compressImage(file) : file);
                  const res = await fetch("/api/uploads", { method: "POST", body: fd });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && (data as { url?: string }).url) {
                    setPhotos((p) => [...p, (data as { url: string }).url]);
                  }
                  setUploading(false);
                  e.target.value = "";
                }}
              />
            </label>
            {photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Attachment ${i + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
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
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save repair"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DvirClient({ canManage = false }: { canManage?: boolean }) {
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

  // Repair tracking
  const [expanded, setExpanded] = useState<string | null>(null);
  const [repairTarget, setRepairTarget] = useState<{ report: DvirReport; item: string; existing?: DvirRepair } | null>(null);

  async function refreshReports() {
    const rep = await fetch("/api/dvir").then((r) => r.json());
    setReports(Array.isArray(rep) ? rep : []);
  }

  async function deleteRepair(repair: DvirRepair) {
    if (!confirm("Remove this repair record?")) return;
    try {
      await apiSend(`/api/dvir/repairs?id=${repair.id}`, "DELETE");
      await refreshReports();
    } catch (err) {
      alert("Error removing repair: " + String(err));
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/vehicles?fleet=1").then((r) => r.json()),
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
      await refreshReports();
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
                      fd.append("file", await compressImage(file));
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
                  <th className="px-4 py-2">Repairs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const failedKeys = failedItemKeys(r);
                  const failedItems = failedKeys.map((k) => ITEM_LABEL[k]);
                  const repairCost = r.repairs.reduce((s, rp) => s + rp.cost, 0);
                  const isOpen = expanded === r.id;
                  return (
                    <Fragment key={r.id}>
                    <tr
                      className={`border-b border-slate-100 hover:bg-slate-50 ${failedKeys.length > 0 ? "cursor-pointer" : ""}`}
                      onClick={() => failedKeys.length > 0 && setExpanded(isOpen ? null : r.id)}
                    >
                      <td className="px-4 py-2 text-xs">
                        <span className="flex items-center gap-1">
                          {failedKeys.length > 0 && (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </td>
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
                      <td className="px-4 py-2 text-xs">
                        {failedKeys.length === 0 ? (
                          "—"
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              r.repairs.length >= failedKeys.length
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            <Wrench size={10} /> {r.repairs.length}/{failedKeys.length} fixed
                            {repairCost > 0 ? ` · ${money(repairCost)}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={7} className="px-4 py-3">
                          <FailedItemsPanel
                            report={r}
                            canManage={canManage}
                            onRecord={(report, item, existing) => setRepairTarget({ report, item, existing })}
                            onDelete={deleteRepair}
                          />
                          {!canManage && (
                            <p className="mt-2 text-[10px] text-slate-400">Only managers can record repairs.</p>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No inspections yet</td></tr>
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
              const failedItems = failedItemKeys(r).map((k) => ITEM_LABEL[k]);
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
                  <div className="mt-2">
                    <FailedItemsPanel
                      report={r}
                      canManage={canManage}
                      onRecord={(report, item, existing) => setRepairTarget({ report, item, existing })}
                      onDelete={deleteRepair}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {repairTarget && (
        <RepairModal
          report={repairTarget.report}
          item={repairTarget.item}
          existing={repairTarget.existing}
          onClose={() => setRepairTarget(null)}
          onSaved={refreshReports}
        />
      )}
    </div>
  );
}
