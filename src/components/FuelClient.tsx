"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Fuel, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Button, Table, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { FuelLogDTO, VehicleDTO, DriverDTO } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { STATION_LABEL } from "@/lib/constants";

const emptyForm = {
  vehicleId: "",
  driverId: "",
  date: new Date().toISOString().slice(0, 10),
  liters: "",
  pricePerLiter: "1.20",
  odometer: "",
  location: "",
};

type FuelApiResponse = {
  logs: FuelLogDTO[];
  stations: string[];
  dateStart: string;
  dateEnd: string;
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
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return s.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function FuelClient({ canManage }: { canManage: boolean }) {
  const [station, setStation] = useState("");
  const [range, setRange] = useState<"week" | "month">("month");
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));

  const apiUrl = `/api/fuel?range=${range}&date=${refDate}${station ? `&station=${station}` : ""}`;
  const { data, loading, reload } = useData<FuelApiResponse>(apiUrl);
  const { data: vehicles } = useData<VehicleDTO[]>("/api/vehicles");
  const { data: drivers } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const logs = data?.logs ?? [];
  const availableStations = data?.stations ?? [];

  function navigate(dir: -1 | 1) {
    const d = new Date(refDate);
    if (range === "week") {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setMonth(d.getMonth() + dir);
    }
    setRefDate(d.toISOString().slice(0, 10));
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        !q ||
        l.vehicle.name.toLowerCase().includes(q) ||
        (l.location ?? "").toLowerCase().includes(q),
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    const cost = logs.reduce((s, l) => s + l.totalCost, 0);
    const liters = logs.reduce((s, l) => s + l.liters, 0);
    return {
      cost,
      liters,
      avg: liters > 0 ? cost / liters : 0,
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Spend" value={formatCurrency(stats.cost)} icon={<Fuel size={18} />} accent="#0891b2" />
        <StatCard label="Total Volume" value={`${formatNumber(stats.liters)} L`} icon={<Fuel size={18} />} accent="#2563eb" />
        <StatCard label="Avg Price/L" value={formatCurrency(stats.avg)} icon={<Fuel size={18} />} accent="#7c3aed" />
        <StatCard label="Fill-ups" value={stats.count} icon={<Fuel size={18} />} accent="#16a34a" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
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
                <Th>Date</Th>
                <Th>Vehicle</Th>
                <Th>Station</Th>
                <Th>Volume</Th>
                <Th>Price/L</Th>
                <Th>Total</Th>
                <Th>Location</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <Td className="text-slate-600">{formatDate(l.date)}</Td>
                  <Td className="font-medium">{l.vehicle.name}</Td>
                  <Td className="text-slate-600">{l.vehicle.station ?? "—"}</Td>
                  <Td>{formatNumber(l.liters, 1)} L</Td>
                  <Td>{formatCurrency(l.pricePerLiter)}</Td>
                  <Td className="font-medium">{formatCurrency(l.totalCost)}</Td>
                  <Td className="text-slate-600">{l.location ?? "—"}</Td>
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
              ))}
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
                ...(vehicles ?? []).map((v) => ({ value: v.id, label: v.name })),
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
          <Field label="Liters" required>
            <Input type="number" step="0.1" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} />
          </Field>
          <Field label="Price / Liter" required>
            <Input type="number" step="0.01" value={form.pricePerLiter} onChange={(e) => setForm({ ...form, pricePerLiter: e.target.value })} />
          </Field>
          <Field label="Odometer (km)">
            <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}
