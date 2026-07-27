"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Truck, RefreshCw, Camera, FileDown, ArrowRightLeft, X, ChevronUp, ChevronDown, ChevronsUpDown, Boxes } from "lucide-react";
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
  STATIONS,
  SISTER_STATIONS,
  FLEET_GROUPS,
  FLEET_GROUP_LABEL,
  IS_TROVA,
  titleCase,
} from "@/lib/constants";
import { useFleetView } from "@/lib/use-fleet-view";
import { SISTER_BRAND } from "@/lib/brand";
import { formatNumber, cn } from "@/lib/utils";

const emptyForm = {
  name: "",
  make: "",
  model: "",
  year: String(new Date().getFullYear()),
  vin: "",
  licensePlate: "",
  type: "TRUCK",
  status: "ACTIVE",
  station: "IAH",
  fuelType: "DIESEL",
  odometer: "0",
  fuelLevel: "100",
  tankCapacity: "200",
  assignedDriverId: "",
  fleetGroup: "REGULAR",
};

type SortKey = "name" | "station" | "type" | "status" | "leasing" | "odometer" | "fuel" | "camera";

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, IDLE: 1, MAINTENANCE: 2, OUT_OF_SERVICE: 3 };

function sortValue(v: VehicleDTO, key: SortKey): string | number {
  switch (key) {
    case "name": return v.name.toLowerCase();
    case "station": return (v.station ?? "").toLowerCase();
    case "type": return (v.type ?? "").toLowerCase();
    case "status": return STATUS_ORDER[v.status] ?? 99;
    case "leasing": return (v.leasingCompany ?? "").toLowerCase();
    case "odometer": return v.odometer ?? 0;
    case "fuel": return v.fuelLevel ?? 0;
    case "camera": return v.hasSamsaraCamera ? 0 : 1;
  }
}

export function VehiclesClient({ canManage }: { canManage: boolean }) {
  const fleetView = useFleetView();
  const { data: vehicles, loading, reload } = useData<VehicleDTO[]>(`/api/vehicles?fv=${fleetView}`);
  const { data: drivers } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [checkingCameras, setCheckingCameras] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDest, setTransferDest] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [fleetOpen, setFleetOpen] = useState(false);
  const [fleetDest, setFleetDest] = useState("");
  const [fleetMoving, setFleetMoving] = useState(false);
  const [fleetError, setFleetError] = useState("");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Active fleet excludes vehicles that are off-boarded or in the off-boarding
  // process — those are managed on the Off-boarding page and must not inflate
  // the fleet total or status distribution.
  const activeVehicles = useMemo(
    () =>
      (vehicles ?? []).filter(
        (v) => v.offboardStatus !== "IN_PROGRESS" && v.offboardStatus !== "COMPLETED",
      ),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeVehicles
      .filter((v) => {
        const matchSearch =
          !q ||
          v.name.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.licensePlate.toLowerCase().includes(q) ||
          v.vin.toLowerCase().includes(q) ||
          (v.dxNumber ?? "").toLowerCase().includes(q);
        const matchStatus = !statusFilter || v.status === statusFilter;
        const matchStation = !stationFilter || v.station === stationFilter;
        return matchSearch && matchStatus && matchStation;
      })
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [activeVehicles, search, statusFilter, stationFilter, sortKey, sortDir]);

  function downloadCsv() {
    const fmtDate = (d: string | null | undefined) =>
      d ? new Date(d).toISOString().slice(0, 10) : "";
    const columns: { header: string; value: (v: VehicleDTO) => string | number }[] = [
      { header: "DX Number", value: (v) => v.dxNumber ?? "" },
      { header: "Name", value: (v) => v.name },
      { header: "License Plate", value: (v) => v.licensePlate },
      { header: "VIN", value: (v) => v.vin },
      { header: "Year", value: (v) => v.year },
      { header: "Make", value: (v) => v.make },
      { header: "Model", value: (v) => v.model },
      { header: "Type", value: (v) => titleCase(v.type) },
      { header: "Status", value: (v) => VEHICLE_STATUS[v.status as keyof typeof VEHICLE_STATUS]?.label ?? v.status },
      { header: "Fleet", value: (v) => FLEET_GROUP_LABEL[v.fleetGroup ?? "REGULAR"] ?? (v.fleetGroup ?? "REGULAR") },
      { header: "Station", value: (v) => STATION_LABEL[v.station]?.split(" — ")[0] ?? v.station },
      { header: "Fuel Type", value: (v) => titleCase(v.fuelType) },
      { header: "Odometer", value: (v) => v.odometer ?? 0 },
      { header: "Leasing Company", value: (v) => v.leasingCompany ?? "" },
      { header: "Lease Type", value: (v) => v.leaseType ?? "" },
      { header: "Lease Start", value: (v) => fmtDate(v.leaseStartDate) },
      { header: "Lease End", value: (v) => fmtDate(v.leaseEndDate) },
      { header: "Monthly Payment", value: (v) => (v.totalRentPerMonth ?? v.monthlyPayment ?? "") as string | number },
      { header: "Camera", value: (v) => (v.hasSamsaraCamera ? "Yes" : "No") },
      { header: "Samsara ID", value: (v) => v.samsaraId ?? "" },
    ];
    const escape = (val: string | number) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      columns.map((c) => c.header).join(","),
      ...filtered.map((v) => columns.map((c) => escape(c.value(v))).join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fleet-vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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
      station: v.station ?? "IAH",
      fuelType: v.fuelType,
      odometer: String(v.odometer),
      fuelLevel: String(v.fuelLevel),
      tankCapacity: String(v.tankCapacity),
      assignedDriverId: v.assignedDriverId ?? "",
      fleetGroup: v.fleetGroup ?? "REGULAR",
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

  function openTransfer() {
    setTransferDest("");
    setTransferError("");
    setTransferOpen(true);
  }

  function openFleet() {
    setFleetDest("");
    setFleetError("");
    setFleetOpen(true);
  }

  async function submitFleet() {
    if (!fleetDest) {
      setFleetError("Choose a fleet.");
      return;
    }
    setFleetMoving(true);
    setFleetError("");
    const res = await apiSend("/api/vehicles/fleet", "POST", {
      ids: [...selected],
      fleetGroup: fleetDest,
    });
    setFleetMoving(false);
    if (res.ok) {
      const d = res.data as { updated: number };
      setFleetOpen(false);
      setSelected(new Set());
      reload();
      setSyncResult(`Moved ${d.updated} vehicle(s) to ${FLEET_GROUP_LABEL[fleetDest] ?? fleetDest}.`);
      setTimeout(() => setSyncResult(null), 6000);
    } else {
      setFleetError(res.error ?? "Move failed");
    }
  }

  async function submitTransfer() {
    if (!transferDest) {
      setTransferError("Choose a destination station.");
      return;
    }
    const destPortal = SISTER_STATIONS.includes(transferDest) ? "sister" : "self";
    if (
      destPortal === "sister" &&
      !confirm(
        `Move ${selected.size} vehicle(s) to ${SISTER_BRAND} (${transferDest})? They will be created in ${SISTER_BRAND} and off-boarded from here.`,
      )
    ) {
      return;
    }
    setTransferring(true);
    setTransferError("");
    const res = await apiSend("/api/vehicles/transfer", "POST", {
      ids: [...selected],
      destStation: transferDest,
      destPortal,
    });
    setTransferring(false);
    if (res.ok) {
      const d = res.data as { moved: number; failed?: { name: string; error: string }[]; destPortal: string; destStation: string };
      setTransferOpen(false);
      setSelected(new Set());
      reload();
      const failNote = d.failed && d.failed.length ? ` ${d.failed.length} failed: ${d.failed.map((f) => f.name).join(", ")}.` : "";
      setSyncResult(`Transferred ${d.moved} vehicle(s) to ${d.destPortal} (${d.destStation}).${failNote}`);
      setTimeout(() => setSyncResult(null), 8000);
    } else {
      setTransferError(res.error ?? "Transfer failed");
    }
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of VEHICLE_STATUSES) counts[s] = 0;
    for (const v of activeVehicles) counts[v.status] = (counts[v.status] || 0) + 1;
    return counts;
  }, [activeVehicles]);

  const donutData = useMemo(() => {
    return VEHICLE_STATUSES.map((s) => ({
      name: VEHICLE_STATUS[s].label,
      value: statusCounts[s] || 0,
      color: VEHICLE_STATUS[s].color,
    })).filter((d) => d.value > 0);
  }, [statusCounts]);

  return (
    <>
    {activeVehicles.length > 0 && (
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-slate-400">Fleet Overview</p>
            <p className="mt-1 text-3xl font-bold">{activeVehicles.length}</p>
            <p className="text-sm text-slate-500">Total Vehicles (excludes off-boarding)</p>
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
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="">All stations</option>
          {STATIONS.map((s) => (
            <option key={s} value={s}>
              {STATION_LABEL[s]?.split(" — ")[0] ?? s}
            </option>
          ))}
        </select>
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
        <Button variant="secondary" onClick={downloadCsv} disabled={filtered.length === 0}>
          <FileDown size={16} /> Download CSV
        </Button>
        {canManage && (
          <>
            <Button variant="secondary" onClick={() => window.open("/api/vehicles/lease-return-report", "_blank")}>
              <FileDown size={16} /> Lease Return Report
            </Button>
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

      {canManage && selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          <span className="font-medium">{selected.size} selected</span>
          <Button variant="secondary" onClick={openTransfer}>
            <ArrowRightLeft size={16} /> Transfer Station
          </Button>
          {!IS_TROVA && (
            <Button variant="secondary" onClick={openFleet}>
              <Boxes size={16} /> Move to Fleet
            </Button>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto inline-flex items-center gap-1 text-blue-700 hover:underline">
            <X size={14} /> Clear
          </button>
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
              {canManage && (
                <Th>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filtered.length > 0 && filtered.every((v) => selected.has(v.id))}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(filtered.map((v) => v.id)) : new Set())
                    }
                  />
                </Th>
              )}
              <Th><SortHeader label="Vehicle" col="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th><SortHeader label="Station" col="station" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th><SortHeader label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th><SortHeader label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th><SortHeader label="Leasing" col="leasing" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th><SortHeader label="Odometer" col="odometer" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th><SortHeader label="Fuel" col="fuel" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th><SortHeader label="Camera" col="camera" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                {canManage && (
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${v.name}`}
                      checked={selected.has(v.id)}
                      onChange={() => toggleSelect(v.id)}
                    />
                  </Td>
                )}
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
                  {v.fleetGroup === "TRACTOR_TRAILER" && (
                    <span className="ml-1 inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Tractor/Trailer</span>
                  )}
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
                  {v.hasSamsaraCamera ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      <Camera size={11} /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      <Camera size={11} /> Not connected
                    </span>
                  )}
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
          {!IS_TROVA && (
            <Field label="Fleet">
              <Select
                value={form.fleetGroup}
                onChange={(e) => setForm({ ...form, fleetGroup: e.target.value })}
                options={FLEET_GROUPS.map((g) => ({ value: g, label: FLEET_GROUP_LABEL[g] ?? g }))}
              />
            </Field>
          )}
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
          <Field label="Station">
            <Select
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              options={STATIONS.map((s) => ({
                value: s,
                label: STATION_LABEL[s as keyof typeof STATION_LABEL] ?? s,
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

      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title={`Transfer ${selected.size} vehicle(s)`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitTransfer} disabled={transferring}>
              {transferring ? "Transferring…" : "Transfer"}
            </Button>
          </>
        }
      >
        <Field label="Destination station">
          <select
            value={transferDest}
            onChange={(e) => setTransferDest(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">Select destination…</option>
            <optgroup label="This portal">
              {STATIONS.map((s) => (
                <option key={s} value={s}>
                  {STATION_LABEL[s] ?? s}
                </option>
              ))}
            </optgroup>
            {SISTER_BRAND && (
              <optgroup label={`${SISTER_BRAND} (other portal)`}>
                {SISTER_STATIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATION_LABEL[s] ?? s}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
        {transferDest && SISTER_STATIONS.includes(transferDest) && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Full move to {SISTER_BRAND}: the vehicle(s) will be created in {SISTER_BRAND} and off-boarded from this portal.
          </p>
        )}
        {transferError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {transferError}
          </p>
        )}
      </Modal>

      <Modal
        open={fleetOpen}
        onClose={() => setFleetOpen(false)}
        title={`Move ${selected.size} vehicle(s) to a fleet`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFleetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitFleet} disabled={fleetMoving}>
              {fleetMoving ? "Moving…" : "Move"}
            </Button>
          </>
        }
      >
        <Field label="Fleet">
          <select
            value={fleetDest}
            onChange={(e) => setFleetDest(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">Select fleet…</option>
            {FLEET_GROUPS.map((g) => (
              <option key={g} value={g}>
                {FLEET_GROUP_LABEL[g] ?? g}
              </option>
            ))}
          </select>
        </Field>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          The regular fleet and the Tractors &amp; Trailers fleet are shown separately via the Fleet selector in the top bar. Moving vehicles here only changes which fleet they belong to — no history is affected.
        </p>
        {fleetError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {fleetError}
          </p>
        )}
      </Modal>
    </Card>
    </>
  );
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (key: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <button
      type="button"
      onClick={() => onClick(col)}
      className={cn(
        "-mx-1 flex items-center gap-1 rounded px-1 py-0.5 uppercase hover:text-slate-700",
        active && "text-slate-800",
      )}
    >
      {label}
      {active ? (
        sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      ) : (
        <ChevronsUpDown size={13} className="text-slate-300" />
      )}
    </button>
  );
}
