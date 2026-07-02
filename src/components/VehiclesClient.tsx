"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2, Truck, RefreshCw, Camera } from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Table,
  Th,
  Td,
  EmptyState,
  ProgressBar,
} from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { DonutChart } from "@/components/charts";
import type { VehicleDTO, DriverDTO } from "@/lib/types";
import {
  VEHICLE_STATUS,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  FUEL_TYPES,
  STATION_LABEL,
  titleCase,
} from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

const emptyForm = {
  name: "",
  make: "",
  model: "",
  year: String(new Date().getFullYear()),
  vin: "",
  licensePlate: "",
  type: "TRUCK",
  status: "ACTIVE",
  fuelType: "DIESEL",
  odometer: "0",
  fuelLevel: "100",
  tankCapacity: "200",
  assignedDriverId: "",
};

export function VehiclesClient({ canManage }: { canManage: boolean }) {
  const { data: vehicles, loading, reload } = useData<VehicleDTO[]>("/api/vehicles");
  const { data: drivers } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [checkingCameras, setCheckingCameras] = useState(false);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter((v) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.licensePlate.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q) ||
        (v.dxNumber ?? "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vehicles, search, statusFilter]);

  async function syncSamsara() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/samsara/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error || "Sync failed"}`);
      } else {
        setSyncResult(`Synced ${data.updated} of ${data.matched} matched vehicles`);
        reload();
      }
    } catch {
      setSyncResult("Error: Network request failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  }

  async function checkCameras() {
    setCheckingCameras(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/samsara/camera-check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error || "Camera check failed"}`);
      } else {
        setSyncResult(
          `Camera check: ${data.withCamera} with camera, ${data.withoutCamera} without. ${data.alertsCreated} new alerts created.`,
        );
        reload();
      }
    } catch {
      setSyncResult("Error: Network request failed");
    } finally {
      setCheckingCameras(false);
      setTimeout(() => setSyncResult(null), 8000);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(v: VehicleDTO) {
    setEditing(v);
    setForm({
      name: v.name,
      make: v.make,
      model: v.model,
      year: String(v.year),
      vin: v.vin,
      licensePlate: v.licensePlate,
      type: v.type,
      status: v.status,
      fuelType: v.fuelType,
      odometer: String(v.odometer),
      fuelLevel: String(v.fuelLevel),
      tankCapacity: String(v.tankCapacity),
      assignedDriverId: v.assignedDriverId ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = editing
      ? await apiSend(`/api/vehicles/${editing.id}`, "PATCH", form)
      : await apiSend("/api/vehicles", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      reload();
    } else {
      setError(res.error ?? "Failed to save");
    }
  }

  async function remove(v: VehicleDTO) {
    if (!confirm(`Delete ${v.name}? This cannot be undone.`)) return;
    const res = await apiSend(`/api/vehicles/${v.id}`, "DELETE");
    if (res.ok) reload();
    else alert(res.error);
  }

  const statusCounts = useMemo(() => {
    if (!vehicles) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const s of VEHICLE_STATUSES) counts[s] = 0;
    for (const v of vehicles) counts[v.status] = (counts[v.status] || 0) + 1;
    return counts;
  }, [vehicles]);

  const donutData = useMemo(() => {
    return VEHICLE_STATUSES.map((s) => ({
      name: VEHICLE_STATUS[s].label,
      value: statusCounts[s] || 0,
      color: VEHICLE_STATUS[s].color,
    })).filter((d) => d.value > 0);
  }, [statusCounts]);

  return (
    <>
    {vehicles && vehicles.length > 0 && (
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-slate-400">Fleet Overview</p>
            <p className="mt-1 text-3xl font-bold">{vehicles.length}</p>
            <p className="text-sm text-slate-500">Total Vehicles</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {VEHICLE_STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: VEHICLE_STATUS[s].color }} />
                  <span className="text-slate-600">{VEHICLE_STATUS[s].label}</span>
                  <span className="ml-auto font-semibold">{statusCounts[s] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-slate-400">Vehicle Status Distribution</p>
            <DonutChart data={donutData} />
          </div>
        </Card>
      </div>
    )}
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, plate, VIN…"
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {VEHICLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {VEHICLE_STATUS[s].label}
            </option>
          ))}
        </select>
        {canManage && (
          <>
            <Button variant="secondary" onClick={syncSamsara} disabled={syncing}>
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Samsara"}
            </Button>
            <Button variant="secondary" onClick={checkCameras} disabled={checkingCameras}>
              <Camera size={16} className={checkingCameras ? "animate-pulse" : ""} />
              {checkingCameras ? "Checking..." : "Check Cameras"}
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Add Vehicle
            </Button>
          </>
        )}
      </div>

      {syncResult && (
        <div className={`mb-4 rounded-lg border px-4 py-2 text-sm ${syncResult.startsWith("Error") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {syncResult}
        </div>
      )}

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Truck size={40} />}
          title="No vehicles found"
          description="Try adjusting filters or add a new vehicle."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Vehicle</Th>
              <Th>Station</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Leasing</Th>
              <Th>Odometer</Th>
              <Th>Fuel</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/vehicles/${v.id}`} className="block">
                    <p className="font-medium text-blue-700 hover:underline">
                      {v.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {v.year} {v.make} {v.model} · {v.licensePlate}
                    </p>
                  </Link>
                </Td>
                <Td className="text-slate-600">
                  {STATION_LABEL[v.station as keyof typeof STATION_LABEL]?.split(" - ")[0] ?? v.station}
                </Td>
                <Td className="text-slate-600">
                  <span>{titleCase(v.type)}</span>
                  {v.branding === "YELLOW_DHL" && (
                    <span className="ml-1 inline-flex rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800">DHL</span>
                  )}
                  {v.branding === "WHITE" && (
                    <span className="ml-1 inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">White</span>
                  )}
                </Td>
                <Td>
                  <Badge
                    bg={VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS].bg}
                    fg={VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS].fg}
                  >
                    {VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS].label}
                  </Badge>
                </Td>
                <Td className="text-slate-600 text-xs">
                  <div>{v.leasingCompany ?? "—"}</div>
                  {v.paidOff ? (
                    <span className="inline-flex rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Paid Off</span>
                  ) : v.monthsLeftPayoff != null && v.monthsLeftPayoff > 0 ? (
                    <span className="text-[10px] text-slate-400">{v.monthsLeftPayoff}mo left</span>
                  ) : null}
                </Td>
                <Td className="text-slate-600">
                  {formatNumber(v.odometer)} mi
                </Td>
                <Td>
                  <div className="w-24">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>{Math.round(v.fuelLevel)}%</span>
                    </div>
                    <ProgressBar value={v.fuelLevel} />
                  </div>
                </Td>
                <Td>
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(v)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(v)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Vehicle" : "Add Vehicle"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="License Plate" required>
            <Input
              value={form.licensePlate}
              onChange={(e) =>
                setForm({ ...form, licensePlate: e.target.value })
              }
            />
          </Field>
          <Field label="Make" required>
            <Input
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
            />
          </Field>
          <Field label="Model" required>
            <Input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </Field>
          <Field label="Year">
            <Input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
          <Field label="VIN" required>
            <Input
              value={form.vin}
              onChange={(e) => setForm({ ...form, vin: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={VEHICLE_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={VEHICLE_STATUSES.map((s) => ({
                value: s,
                label: VEHICLE_STATUS[s].label,
              }))}
            />
          </Field>
          <Field label="Fuel Type">
            <Select
              value={form.fuelType}
              onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
              options={FUEL_TYPES.map((f) => ({ value: f, label: titleCase(f) }))}
            />
          </Field>
          <Field label="Assigned Driver">
            <Select
              value={form.assignedDriverId}
              onChange={(e) =>
                setForm({ ...form, assignedDriverId: e.target.value })
              }
              options={[
                { value: "", label: "Unassigned" },
                ...(drivers ?? []).map((d) => ({
                  value: d.id,
                  label: `${d.firstName} ${d.lastName}`,
                })),
              ]}
            />
          </Field>
          <Field label="Odometer (mi)">
            <Input
              type="number"
              value={form.odometer}
              onChange={(e) => setForm({ ...form, odometer: e.target.value })}
            />
          </Field>
          <Field label="Fuel Level (%)">
            <Input
              type="number"
              value={form.fuelLevel}
              onChange={(e) => setForm({ ...form, fuelLevel: e.target.value })}
            />
          </Field>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </Modal>
    </Card>
    </>
  );
}
