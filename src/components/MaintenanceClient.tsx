"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Wrench } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { Field, Input, Select, Textarea, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { WorkOrderDTO, VehicleDTO, ServiceDTO } from "@/lib/types";
import {
  WO_STATUS,
  WO_STATUSES,
  WO_TYPES,
  PRIORITY,
  PRIORITIES,
  STATIONS,
  STATION_LABEL,
  SERVICE_CATEGORY,
  titleCase,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_RATE = "95";

const emptyForm = {
  vehicleId: "",
  serviceId: "",
  station: "AUS",
  type: "SCHEDULED_SERVICE",
  title: "",
  description: "",
  status: "OPEN",
  priority: "MEDIUM",
  materialCost: "0",
  laborHours: "0",
  laborRate: DEFAULT_RATE,
  vendor: "",
  scheduledFor: "",
};

export function MaintenanceClient({ canManage }: { canManage: boolean }) {
  const { data: orders, loading, reload } = useData<WorkOrderDTO[]>("/api/maintenance");
  const { data: vehicles } = useData<VehicleDTO[]>("/api/vehicles");
  const { data: services } = useData<ServiceDTO[]>("/api/services");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        !q || o.title.toLowerCase().includes(q) || o.vehicle.name.toLowerCase().includes(q);
      return (
        matchSearch &&
        (!statusFilter || o.status === statusFilter) &&
        (!stationFilter || o.station === stationFilter)
      );
    });
  }, [orders, search, statusFilter, stationFilter]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    return {
      open: list.filter((o) => o.status === "OPEN").length,
      inProgress: list.filter((o) => o.status === "IN_PROGRESS").length,
      overdue: list.filter(
        (o) =>
          o.scheduledFor &&
          new Date(o.scheduledFor) < new Date() &&
          (o.status === "OPEN" || o.status === "SCHEDULED"),
      ).length,
      cost: list
        .filter((o) => o.status === "COMPLETED")
        .reduce((s, o) => s + o.cost, 0),
    };
  }, [orders]);

  const laborTotal = Number(form.laborHours || 0) * Number(form.laborRate || 0);
  const total = Number(form.materialCost || 0) + laborTotal;

  function onSelectService(serviceId: string) {
    const svc = (services ?? []).find((s) => s.id === serviceId);
    if (!svc) {
      setForm((f) => ({ ...f, serviceId }));
      return;
    }
    const rate = Number(form.laborRate || DEFAULT_RATE) || Number(DEFAULT_RATE);
    setForm((f) => ({
      ...f,
      serviceId,
      title: svc.name,
      type: svc.category === "PREVENTIVE" ? "SCHEDULED_SERVICE" : "REPAIR",
      materialCost: String(svc.materialCost),
      laborRate: String(rate),
      laborHours: rate > 0 ? String(Math.round((svc.laborCost / rate) * 10) / 10) : "0",
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await apiSend("/api/maintenance", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      setForm(emptyForm);
      reload();
    } else setError(res.error ?? "Failed");
  }
  async function setStatus(o: WorkOrderDTO, status: string) {
    const res = await apiSend(`/api/maintenance/${o.id}`, "PATCH", { status });
    if (res.ok) reload();
  }
  async function remove(o: WorkOrderDTO) {
    if (!confirm("Delete this work order?")) return;
    const res = await apiSend(`/api/maintenance/${o.id}`, "DELETE");
    if (res.ok) reload();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={stats.open} icon={<Wrench size={18} />} accent="#d97706" />
        <StatCard label="In Progress" value={stats.inProgress} icon={<Wrench size={18} />} accent="#2563eb" />
        <StatCard label="Overdue" value={stats.overdue} icon={<Wrench size={18} />} accent="#dc2626" />
        <StatCard label="Completed Cost" value={formatCurrency(stats.cost)} icon={<Wrench size={18} />} accent="#16a34a" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search work orders…"
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
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {WO_STATUSES.map((s) => (
              <option key={s} value={s}>{WO_STATUS[s].label}</option>
            ))}
          </select>
          {canManage && (
            <Button onClick={() => { setForm(emptyForm); setError(""); setModalOpen(true); }}>
              <Plus size={16} /> New Work Order
            </Button>
          )}
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Wrench size={40} />} title="No work orders found" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Work Order</Th>
                <Th>Vehicle</Th>
                <Th>Station</Th>
                <Th>Material</Th>
                <Th>Labor</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const cat = o.service?.category;
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <Td>
                      <p className="font-medium">{o.title}</p>
                      <p className="text-xs text-slate-400">
                        {cat ? SERVICE_CATEGORY[cat as keyof typeof SERVICE_CATEGORY].label + " · " : ""}
                        {titleCase(o.type)}
                      </p>
                    </Td>
                    <Td className="text-slate-600">{o.vehicle.name}</Td>
                    <Td>
                      <Badge bg="#eef2ff" fg="#3730a3">{o.station}</Badge>
                    </Td>
                    <Td className="text-slate-600">{formatCurrency(o.materialCost)}</Td>
                    <Td className="text-slate-600">
                      {formatCurrency(o.laborCost)}
                      {o.laborHours > 0 && (
                        <span className="block text-xs text-slate-400">
                          {o.laborHours}h × {formatCurrency(o.laborRate)}
                        </span>
                      )}
                    </Td>
                    <Td className="font-semibold">{formatCurrency(o.cost)}</Td>
                    <Td>
                      {canManage ? (
                        <select
                          value={o.status}
                          onChange={(e) => setStatus(o, e.target.value)}
                          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
                        >
                          {WO_STATUSES.map((s) => (
                            <option key={s} value={s}>{WO_STATUS[s].label}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge
                          bg={WO_STATUS[o.status as keyof typeof WO_STATUS].bg}
                          fg={WO_STATUS[o.status as keyof typeof WO_STATUS].fg}
                        >
                          {WO_STATUS[o.status as keyof typeof WO_STATUS].label}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {canManage && (
                        <button
                          onClick={() => remove(o)}
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
        title="New Work Order"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vehicle" required>
            <Select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              options={[
                { value: "", label: "Select vehicle…" },
                ...(vehicles ?? []).map((v) => ({ value: v.id, label: v.name })),
              ]}
            />
          </Field>
          <Field label="Station" required>
            <Select
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              options={STATIONS.map((s) => ({ value: s, label: STATION_LABEL[s] }))}
            />
          </Field>
          <Field label="Service" className="col-span-2">
            <Select
              value={form.serviceId}
              onChange={(e) => onSelectService(e.target.value)}
              options={[
                { value: "", label: "Custom / none — enter title below" },
                ...(services ?? []).map((s) => ({
                  value: s.id,
                  label: `${SERVICE_CATEGORY[s.category as keyof typeof SERVICE_CATEGORY].label} · ${s.name}`,
                })),
              ]}
            />
          </Field>
          <Field label="Title" required className="col-span-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p].label }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={WO_STATUSES.map((s) => ({ value: s, label: WO_STATUS[s].label }))}
            />
          </Field>
          <Field label="Material cost ($)">
            <Input type="number" min="0" value={form.materialCost} onChange={(e) => setForm({ ...form, materialCost: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={WO_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
            />
          </Field>
          <Field label="Labor hours">
            <Input type="number" min="0" step="0.1" value={form.laborHours} onChange={(e) => setForm({ ...form, laborHours: e.target.value })} />
          </Field>
          <Field label="Labor rate ($/hr)">
            <Input type="number" min="0" value={form.laborRate} onChange={(e) => setForm({ ...form, laborRate: e.target.value })} />
          </Field>
          <div className="col-span-2 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-500">Labor {formatCurrency(laborTotal)} + Material {formatCurrency(Number(form.materialCost || 0))}</span>
            <span className="font-semibold">Total {formatCurrency(total)}</span>
          </div>
          <Field label="Scheduled For">
            <Input type="date" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
          </Field>
          <Field label="Vendor">
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Field>
          <Field label="Description" className="col-span-2">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}
