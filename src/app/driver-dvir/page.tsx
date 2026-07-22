"use client";

import { useState, useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { STATIONS, STATION_LABEL } from "@/lib/constants";
import { ClipboardCheck, CheckCircle2, Truck, Camera } from "lucide-react";

type Vehicle = { id: string; name: string; dxNumber: string | null };

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

const STATION_OPTIONS = STATIONS.map((value) => ({
  value,
  label: STATION_LABEL[value] ?? value,
}));

export default function DriverDvirPage() {
  const [station, setStation] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [odometer, setOdometer] = useState("");
  const [items, setItems] = useState<Record<string, string>>(
    Object.fromEntries(INSPECTION_ITEMS.map(({ key }) => [key, "PASS"]))
  );
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!station) {
      setVehicles([]);
      setVehicleId("");
      return;
    }
    fetch(`/api/dvir/public?station=${station}`)
      .then((r) => r.json())
      .then((data) => {
        setVehicles(Array.isArray(data) ? data : []);
        setVehicleId("");
      });
  }, [station]);

  async function submit() {
    setError("");
    if (!driverName.trim()) return setError("Please enter your name");
    if (!station) return setError("Please select a station");
    if (!vehicleId) return setError("Please select a vehicle");

    setSubmitting(true);
    try {
      const res = await fetch("/api/dvir/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          driverName: driverName.trim(),
          station,
          odometer: odometer ? Number(odometer) : undefined,
          ...items,
          notes: notes || undefined,
          photos: photos.length > 0 ? JSON.stringify(photos) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to submit");
      }
      setSuccess(true);
      setItems(Object.fromEntries(INSPECTION_ITEMS.map(({ key }) => [key, "PASS"])));
      setNotes("");
      setPhotos([]);
      setOdometer("");
      setVehicleId("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-green-50 px-4">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-800">DVIR Submitted!</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your vehicle inspection has been recorded successfully.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Submit Another Inspection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-5 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold">DVIR — Vehicle Inspection</h1>
            <p className="text-xs text-blue-200">{BRAND} &middot; Pre/Post-Trip Inspection</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Driver Name */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Your Name *</label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Station */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Station *</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATION_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStation(s.value)}
                className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  station === s.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {s.value}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle */}
        {station && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              <Truck size={14} className="mr-1 inline" /> Vehicle *
            </label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select vehicle...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.dxNumber ?? v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Odometer */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Odometer Reading</label>
          <input
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Current mileage"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Inspection Items */}
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-700">Inspection Checklist</p>
          <div className="space-y-2">
            {INSPECTION_ITEMS.map(({ key, label }) => (
              <div
                key={key}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  items[key] === "FAIL"
                    ? "border-red-300 bg-red-50"
                    : items[key] === "NA"
                      ? "border-slate-200 bg-slate-50"
                      : "border-green-200 bg-green-50"
                }`}
              >
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <div className="flex gap-1">
                  {(["PASS", "FAIL", "NA"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setItems((prev) => ({ ...prev, [key]: status }))}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        items[key] === status
                          ? status === "PASS"
                            ? "bg-green-600 text-white"
                            : status === "FAIL"
                              ? "bg-red-600 text-white"
                              : "bg-slate-500 text-white"
                          : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
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
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            Notes / Description of Issues
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Describe any damage, issues, or concerns..."
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Photos */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            <Camera size={14} className="mr-1 inline" /> Photos
          </label>
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50">
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
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                  />
                  <button
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
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
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit DVIR Inspection"}
        </button>

        <p className="text-center text-xs text-slate-400">
          {BRAND} &middot; Driver Vehicle Inspection Report
        </p>
      </div>
    </div>
  );
}
