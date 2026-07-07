"use client";

import { useState } from "react";
import { Pencil, X, Save } from "lucide-react";
import { apiSend } from "@/lib/use-data";
import { STATIONS } from "@/lib/constants";

type VehicleData = {
  id: string;
  name: string;
  dxNumber: string | null;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string | null;
  type: string;
  station: string;
  fuelType: string;
  odometer: number;
  tankCapacity: number;
  leasingCompany: string | null;
  leaseEndDate: string | null;
  registrationMonth: string | null;
  registrationExpiry: string | null;
  insuranceExpiry: string | null;
  lifecycleStatus: string;
  purchasePrice: number | null;
  taxesAndFees: number | null;
  brandingCost: number | null;
  gpsCamerasCost: number | null;
  upfittingCost: number | null;
  registrationCost: number | null;
  initialInsurance: number | null;
};

const TYPES = ["VAN", "TRUCK", "CAR", "BUS", "PICKUP", "TRAILER"];
const FUEL_TYPES = ["DIESEL", "GASOLINE", "ELECTRIC", "HYBRID", "CNG"];
const LIFECYCLE_STAGES = ["PLANNING", "ACQUISITION_APPROVED", "ORDERED", "IN_TRANSIT", "RECEIVED", "UPFITTING", "REGISTERED", "ASSIGNED", "ACTIVE", "TEMP_OUT", "LONG_TERM_REPAIR", "READY_DISPOSAL", "SOLD_RETURNED", "ARCHIVED"];

export function VehicleEditForm({ vehicle }: { vehicle: VehicleData }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...vehicle });

  const set = (field: string, value: string | number | null) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function save() {
    setSaving(true);
    try {
      await apiSend(`/api/vehicles/${vehicle.id}`, "PATCH", {
        name: form.name,
        dxNumber: form.dxNumber || null,
        make: form.make,
        model: form.model,
        year: Number(form.year),
        vin: form.vin,
        licensePlate: form.licensePlate || null,
        type: form.type,
        station: form.station,
        fuelType: form.fuelType,
        odometer: Number(form.odometer),
        tankCapacity: Number(form.tankCapacity),
        leasingCompany: form.leasingCompany || null,
        leaseEndDate: form.leaseEndDate || null,
        registrationMonth: form.registrationMonth || null,
        registrationExpiry: form.registrationExpiry || null,
        insuranceExpiry: form.insuranceExpiry || null,
        lifecycleStatus: form.lifecycleStatus,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        taxesAndFees: form.taxesAndFees ? Number(form.taxesAndFees) : null,
        brandingCost: form.brandingCost ? Number(form.brandingCost) : null,
        gpsCamerasCost: form.gpsCamerasCost ? Number(form.gpsCamerasCost) : null,
        upfittingCost: form.upfittingCost ? Number(form.upfittingCost) : null,
        registrationCost: form.registrationCost ? Number(form.registrationCost) : null,
        initialInsurance: form.initialInsurance ? Number(form.initialInsurance) : null,
      });
      window.location.reload();
    } catch (err) {
      alert("Error saving: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <Pencil size={14} /> Edit Vehicle Info
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Edit Vehicle</h3>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Field label="Name / DX" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="DX Number" value={form.dxNumber ?? ""} onChange={(v) => set("dxNumber", v)} />
        <Field label="Year" value={String(form.year)} onChange={(v) => set("year", v)} type="number" />
        <Field label="Make" value={form.make} onChange={(v) => set("make", v)} />
        <Field label="Model" value={form.model} onChange={(v) => set("model", v)} />
        <Field label="VIN" value={form.vin} onChange={(v) => set("vin", v)} />
        <Field label="License Plate" value={form.licensePlate ?? ""} onChange={(v) => set("licensePlate", v)} />
        <SelectField label="Type" value={form.type} options={TYPES} onChange={(v) => set("type", v)} />
        <SelectField label="Station" value={form.station} options={[...STATIONS]} onChange={(v) => set("station", v)} />
        <SelectField label="Fuel Type" value={form.fuelType} options={FUEL_TYPES} onChange={(v) => set("fuelType", v)} />
        <Field label="Odometer (mi)" value={String(form.odometer)} onChange={(v) => set("odometer", v)} type="number" />
        <Field label="Tank Capacity (L)" value={String(form.tankCapacity)} onChange={(v) => set("tankCapacity", v)} type="number" />
        <Field label="Leasing Company" value={form.leasingCompany ?? ""} onChange={(v) => set("leasingCompany", v)} />
        <Field label="Lease End Date" value={form.leaseEndDate ?? ""} onChange={(v) => set("leaseEndDate", v)} type="date" />
        <Field label="Registration Month" value={form.registrationMonth ?? ""} onChange={(v) => set("registrationMonth", v)} />
        <Field label="Registration Expiry" value={form.registrationExpiry ?? ""} onChange={(v) => set("registrationExpiry", v)} type="date" />
        <Field label="Insurance Expiry" value={form.insuranceExpiry ?? ""} onChange={(v) => set("insuranceExpiry", v)} type="date" />
        <SelectField label="Lifecycle Status" value={form.lifecycleStatus} options={LIFECYCLE_STAGES} onChange={(v) => set("lifecycleStatus", v)} />
      </div>

      <p className="mt-4 mb-2 text-[10px] font-semibold uppercase text-slate-500">Initial Investment</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Field label="Purchase Price" value={String(form.purchasePrice ?? "")} onChange={(v) => set("purchasePrice", v)} type="number" />
        <Field label="Taxes & Fees" value={String(form.taxesAndFees ?? "")} onChange={(v) => set("taxesAndFees", v)} type="number" />
        <Field label="Branding Cost" value={String(form.brandingCost ?? "")} onChange={(v) => set("brandingCost", v)} type="number" />
        <Field label="GPS & Cameras" value={String(form.gpsCamerasCost ?? "")} onChange={(v) => set("gpsCamerasCost", v)} type="number" />
        <Field label="Upfitting" value={String(form.upfittingCost ?? "")} onChange={(v) => set("upfittingCost", v)} type="number" />
        <Field label="Registration Cost" value={String(form.registrationCost ?? "")} onChange={(v) => set("registrationCost", v)} type="number" />
        <Field label="Initial Insurance" value={String(form.initialInsurance ?? "")} onChange={(v) => set("initialInsurance", v)} type="number" />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={() => { setForm({ ...vehicle }); setEditing(false); }}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
