"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Fuel, ChevronLeft, ChevronRight, AlertTriangle, CreditCard, Flag, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Button, Table, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { FuelLogDTO, VehicleDTO, DriverDTO } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber, APP_TIMEZONE } from "@/lib/utils";
import { STATION_LABEL } from "@/lib/constants";

const emptyForm = {
  vehicleId: "",
  driverId: "",
  date: new Date().toISOString().slice(0, 10),
  liters: "",
  pricePerLiter: "1.20",
  odometer: "",
  location: "",
  transactionTime: "",
  purchaseType: "UNLEADED",
};

type FuelSortKey =
  | "date" | "vehicle" | "driver" | "type" | "station"
  | "volume" | "price" | "total" | "location" | "time" | "status";

type PurchaseBreakdownItem = {
  type: string;
  count: number;
  totalCost: number;
  totalLiters: number;
};

type FuelApiResponse = {
  logs: FuelLogDTO[];
  stations: string[];
  dateStart: string;
  dateEnd: string;
  purchaseBreakdown: PurchaseBreakdownItem[];
  duplicates: string[];
  inactiveCards: string[];
};

const PURCHASE_TYPE_LABEL: Record<string, string> = {
  UNLEADED: "Unleaded",
  DIESEL: "Diesel",
  DEF: "DEF",
  NON_FUEL: "Non-Fuel",
};

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function formatDateRange(start: string, end: string, range: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (range === "week") {
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  return s.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function FuelClient({ canManage }: { canManage: boolean }) {
  const [station, setStation] = useState("");
  const [range, setRange] = useState<"week" | "month">("month");
  const [refDate, setRefDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [purchaseType, setPurchaseType] = useState("");
  const [viewTab, setViewTab] = useState<"all" | "duplicates">("all");

  const apiUrl = `/api/fuel?range=${range}&date=${refDate}${station ? `&station=${station}` : ""}${purchaseType ? `&purchaseType=${purchaseType}` : ""}`;
  const { data, loading, reload } = useData<FuelApiResponse>(apiUrl);
  const { data: vehicles } = useData<VehicleDTO[]>("/api/vehicles?fleet=1");
  const { data: drivers } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<FuelSortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [modalOpen, setModalOpen] = useState(false);

  function toggleSort(key: FuelSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const availableStations = data?.stations ?? [];

  function navigate(dir: -1 | 1) {
    const d = new Date(refDate + "T12:00:00");
    if (range === "week") {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
    }
    setRefDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const logs = useMemo(() => data?.logs ?? [], [data]);

  const duplicateSet = useMemo(() => new Set(data?.duplicates ?? []), [data]);
  const inactiveCardSet = useMemo(() => new Set(data?.inactiveCards ?? []), [data]);

  const duplicateOnlyLogs = useMemo(() => {
    return logs.filter((l) => {
      const dateKey = `${l.vehicleId}|${new Date(l.date!).toISOString().slice(0, 10)}`;
      return duplicateSet.has(dateKey);
    });
  }, [logs, duplicateSet]);

  const filtered = useMemo(() => {
    const base = viewTab === "duplicates" ? duplicateOnlyLogs : logs;
    const q = search.toLowerCase();
    const rows = base.filter(
      (l) =>
        !q ||
        l.vehicle.name.toLowerCase().includes(q) ||
        (l.location ?? "").toLowerCase().includes(q) ||
        (l.driverName ?? "").toLowerCase().includes(q),
    );
    const val = (l: FuelLogDTO): string | number => {
      switch (sortKey) {
        case "date": return new Date(l.date!).getTime();
        case "vehicle": return l.vehicle.name.toLowerCase();
        case "driver": return (l.driverName || (l.driver ? `${l.driver.firstName} ${l.driver.lastName}` : "")).toLowerCase();
        case "type": return (PURCHASE_TYPE_LABEL[l.purchaseType] ?? l.purchaseType).toLowerCase();
        case "station": return (l.vehicle.station ?? "").toLowerCase();
        case "volume": return l.liters;
        case "price": return l.pricePerLiter;
        case "total": return l.totalCost;
        case "location": return (l.location ?? "").toLowerCase();
        case "time": return (l.transactionTime ?? "");
        case "status": {
          const key = `${l.vehicleId}|${new Date(l.date!).toISOString().slice(0, 10)}`;
          return (inactiveCardSet.has(l.vehicleId) ? 2 : 0) + (duplicateSet.has(key) ? 1 : 0);
        }
      }
    };
    return rows.sort((a, b) => {
      const av = val(a), bv = val(b);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [logs, duplicateOnlyLogs, viewTab, search, sortKey, sortDir, duplicateSet, inactiveCardSet]);

  const breakdown = data?.purchaseBreakdown ?? [];
  const gasCost = breakdown.find((b) => b.type === "UNLEADED")?.totalCost ?? 0;
  const dieselCost = breakdown.find((b) => b.type === "DIESEL")?.totalCost ?? 0;

  const stats = useMemo(() => {
    const cost = logs.reduce((s, l) => s + l.totalCost, 0);
    const gal = logs.reduce((s, l) => s + l.liters, 0);
    return {
      cost,
      gal,
      avg: gal > 0 ? cost / gal : 0,
      count: logs.length,
    };
  }, [logs]);

  async function save() {
    setSaving(true);
    setError("");
    const res = await apiSend("/api/fuel", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      setForm(emptyForm);
      reload();
    } else setError(res.error ?? "Failed");
  }
  async function remove(l: FuelLogDTO) {
    if (!confirm("Delete this fuel record?")) return;
    const res = await apiSend(`/api/fuel/${l.id}`, "DELETE");
    if (res.ok) reload();
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Station filter */}
        <select
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm"
        >
          <option value="">All stations</option>
          {availableStations.map((s) => (
            <option key={s} value={s}>{STATION_LABEL[s] ?? s}</option>
          ))}
        </select>

        {/* Week/Month toggle */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setRange("week")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              range === "week"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setRange("month")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              range === "month"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Month
          </button>
        </div>

        {/* Purchase type filter */}
        <select
          value={purchaseType}
          onChange={(e) => setPurchaseType(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="UNLEADED">Unleaded</option>
          <option value="DIESEL">Diesel</option>
          <option value="DEF">DEF</option>
          <option value="NON_FUEL">Non-Fuel</option>
        </select>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[180px] text-center text-sm font-medium text-slate-700">
            {data ? formatDateRange(data.dateStart, data.dateEnd, range) : "Loading..."}
          </span>
          <button
            onClick={() => navigate(1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Spend" value={formatCurrency(stats.cost)} icon={<Fuel size={18} />} accent="#0891b2" />
        <StatCard label="Gas (Unleaded)" value={formatCurrency(gasCost)} icon={<Fuel size={18} />} accent="#f59e0b" />
        <StatCard label="Diesel" value={formatCurrency(dieselCost)} icon={<Fuel size={18} />} accent="#6366f1" />
        <StatCard label="Total Volume" value={`${formatNumber(stats.gal)} Gal`} icon={<Fuel size={18} />} accent="#2563eb" />
        <StatCard label="Avg Price/Gal" value={formatCurrency(stats.avg)} icon={<Fuel size={18} />} accent="#7c3aed" />
        <StatCard label="Fill-ups" value={stats.count} icon={<Fuel size={18} />} accent="#16a34a" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          {/* View tabs */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setViewTab("all")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewTab === "all" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setViewTab("duplicates")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewTab === "duplicates" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-1">
                <AlertTriangle size={13} /> Duplicates ({duplicateOnlyLogs.length})
              </span>
            </button>
          </div>

          {viewTab === "duplicates" && duplicateOnlyLogs.length > 0 && (
            <button
              onClick={() => {
                const desc = `${duplicateOnlyLogs.length} duplicate fuel entries found for ${station || "all stations"} in ${data?.dateStart ? new Date(data.dateStart).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "this period"}. Please review and explain.`;
                window.open(`/issues?create=1&title=${encodeURIComponent("Fuel Duplicates" + (station ? ` - ${station}` : ""))}&description=${encodeURIComponent(desc)}&category=Fuel&station=${station || ""}`, "_self");
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Flag size={14} /> Flag Issue
            </button>
          )}

          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fuel logs…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          {canManage && (
            <Button onClick={() => { setForm(emptyForm); setError(""); setModalOpen(true); }}>
              <Plus size={16} /> Log Fuel
            </Button>
          )}
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Fuel size={40} />} title="No fuel records" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th><FuelSortHeader label="Date" col="date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Vehicle" col="vehicle" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Driver" col="driver" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Type" col="type" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Station" col="station" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Location" col="location" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Txn Time" col="time" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Volume" col="volume" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Price/Gal" col="price" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Total" col="total" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><FuelSortHeader label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const dateKey = `${l.vehicleId}|${new Date(l.date!).toISOString().slice(0, 10)}`;
                const isDuplicate = duplicateSet.has(dateKey);
                const isInactiveCard = inactiveCardSet.has(l.vehicleId);
                return (
                  <tr key={l.id} className={`hover:bg-slate-50 ${isDuplicate ? "bg-amber-50/50" : ""}`}>
                    <Td className="text-slate-600">{formatDate(l.date)}</Td>
                    <Td className="font-medium">{l.vehicle.name}</Td>
                    <Td className="text-slate-600">{l.driverName || (l.driver ? `${l.driver.firstName} ${l.driver.lastName}` : "—")}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        l.purchaseType === "UNLEADED" ? "bg-amber-50 text-amber-700" :
                        l.purchaseType === "DIESEL" ? "bg-indigo-50 text-indigo-700" :
                        l.purchaseType === "DEF" ? "bg-emerald-50 text-emerald-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {PURCHASE_TYPE_LABEL[l.purchaseType] ?? l.purchaseType}
                      </span>
                    </Td>
                    <Td className="text-slate-600">{l.vehicle.station ?? "—"}</Td>
                    <Td className="text-slate-600">{l.location ?? "—"}</Td>
                    <Td className="text-slate-600">{l.transactionTime ?? "—"}</Td>
                    <Td>{formatNumber(l.liters, 1)} Gal</Td>
                    <Td>{formatCurrency(l.pricePerLiter)}</Td>
                    <Td className="font-medium">{formatCurrency(l.totalCost)}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        {isDuplicate && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700" title="Multiple charges same day">
                            <AlertTriangle size={11} /> Duplicate
                          </span>
                        )}
                        {isInactiveCard && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" title="Card inactive 15+ days">
                            <CreditCard size={11} /> Card Not Working
                          </span>
                        )}
                        {!isDuplicate && !isInactiveCard && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {canManage && (
                        <button
                          onClick={() => remove(l)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log Fuel Purchase"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vehicle" required className="col-span-2">
            <Select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              options={[
                { value: "", label: "Select vehicle…" },
                ...(vehicles ?? []).filter((v) => !station || (v as Record<string, unknown>).station === station).map((v) => ({ value: v.id, label: v.name })),
              ]}
            />
          </Field>
          <Field label="Driver">
            <Select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              options={[
                { value: "", label: "—" },
                ...(drivers ?? []).map((d) => ({ value: d.id, label: `${d.firstName} ${d.lastName}` })),
              ]}
            />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Gallons" required>
            <Input type="number" step="0.1" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} />
          </Field>
          <Field label="Price / Gal" required>
            <Input type="number" step="0.01" value={form.pricePerLiter} onChange={(e) => setForm({ ...form, pricePerLiter: e.target.value })} />
          </Field>
          <Field label="Odometer (mi)">
            <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} />
          </Field>
          <Field label="Fuel Type" required>
            <Select
              value={form.purchaseType}
              onChange={(e) => setForm({ ...form, purchaseType: e.target.value })}
              options={[
                { value: "UNLEADED", label: "Unleaded" },
                { value: "DIESEL", label: "Diesel" },
                { value: "DEF", label: "DEF" },
                { value: "NON_FUEL", label: "Non-Fuel" },
              ]}
            />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Transaction Time">
            <Input type="time" value={form.transactionTime} onChange={(e) => setForm({ ...form, transactionTime: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}

function FuelSortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  col: FuelSortKey;
  sortKey: FuelSortKey;
  sortDir: "asc" | "desc";
  onClick: (key: FuelSortKey) => void;
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
