"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Pencil, Trash2, Wrench, ClipboardList, AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, SortTh, EmptyState, StatCard } from "@/components/ui";
import { Field, Input, Select, Textarea, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useFleetView } from "@/lib/use-fleet-view";
import { useTableSort } from "@/lib/use-sort";
import type { WorkOrderDTO, VehicleDTO, ServiceDTO, WorkOrderRequestDTO } from "@/lib/types";
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
  IS_TROVA,
} from "@/lib/constants";
import { formatCurrency, todayInputDate } from "@/lib/utils";

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

export function MaintenanceClient({
  canManage,
  isVendor = false,
  performerName = "",
}: {
  canManage: boolean;
  isVendor?: boolean;
  performerName?: string;
}) {
  const fleetView = useFleetView();
  const { data: orders, loading, reload } = useData<WorkOrderDTO[]>(`/api/maintenance?fv=${fleetView}`);
  const { data: vehicles } = useData<VehicleDTO[]>(isVendor ? null : "/api/vehicles?fleet=1&allFleets=1");
  const { data: services } = useData<ServiceDTO[]>(isVendor ? null : "/api/services");
  const { data: woRequests } = useData<WorkOrderRequestDTO[]>(
    isVendor ? null : "/api/work-order-requests",
  );
  const [completing, setCompleting] = useState<WorkOrderDTO | null>(null);

  const pendingRequests = useMemo(() => {
    return (woRequests ?? []).filter((r) => r.status === "PENDING");
  }, [woRequests]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("COMPLETED");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const sort = useTableSort<WorkOrderDTO, "wo" | "po" | "title" | "vehicle" | "station" | "mileage" | "material" | "labor" | "total" | "status">(
    {
      wo: (o) => o.id.slice(-6).toLowerCase(),
      po: (o) => (o.poNumber ?? "").toLowerCase(),
      title: (o) => o.title.toLowerCase(),
      vehicle: (o) => (o.vehicle?.name ?? o.vehicleOther ?? "").toLowerCase(),
      station: (o) => o.station ?? "",
      mileage: (o) => o.odometerAt ?? null,
      material: (o) => o.materialCost,
      labor: (o) => o.laborCost,
      total: (o) => o.cost,
      status: (o) => o.status,
    },
    "title",
  );

  const filtered = useMemo(() => {
    if (!orders) return [];
    const q = search.toLowerCase();
    const result = orders.filter((o) => {
      const matchSearch =
        !q || o.title.toLowerCase().includes(q) || (o.vehicle?.name ?? o.vehicleOther ?? "").toLowerCase().includes(q);
      return (
        matchSearch &&
        (!statusFilter || o.status === statusFilter) &&
        (!stationFilter || o.station === stationFilter)
      );
    });
    return sort.sortRows(result);
  }, [orders, search, statusFilter, stationFilter, sort]);

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

  function openEdit(o: WorkOrderDTO) {
    setEditingId(o.id);
    setForm({
      vehicleId: o.vehicleId ?? "",
      serviceId: o.serviceId ?? "",
      station: o.station ?? "AUS",
      type: o.type,
      title: o.title,
      description: o.description ?? "",
      status: o.status,
      priority: o.priority,
      materialCost: String(o.materialCost ?? "0"),
      laborHours: String(o.laborHours ?? "0"),
      laborRate: String(o.laborRate ?? DEFAULT_RATE),
      vendor: o.vendor ?? "",
      scheduledFor: o.scheduledFor ? String(o.scheduledFor).slice(0, 10) : "",
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = editingId
      ? await apiSend(`/api/maintenance/${editingId}`, "PATCH", form)
      : await apiSend("/api/maintenance", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((o) => o.id)));
    }
  }

  async function bulkUpdateStatus() {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((id) => apiSend(`/api/maintenance/${id}`, "PATCH", { status: bulkStatus })),
    );
    setBulkProcessing(false);
    setSelectedIds(new Set());
    reload();
  }

  return (
    <div className="space-y-4">
      {/* Pending WO Requests banner */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              <h3 className="text-sm font-bold text-amber-800">
                {pendingRequests.length} Pending Work Order Request{pendingRequests.length > 1 ? "s" : ""}
              </h3>
            </div>
            <Link
              href="/work-order-requests"
              className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Review All
            </Link>
          </div>
          <div className="space-y-2">
            {pendingRequests.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <ClipboardList size={16} className="text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {r.poNumber ? <span className="font-mono mr-2">{r.poNumber}</span> : null}
                      {r.service?.name ?? "Service request"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.vehicle ? `${r.vehicle.licensePlate} - ${r.vehicle.name}` : r.vehicleOther ?? ""}
                      {" "}&middot; {r.station} &middot; by {r.requestedBy.name}
                    </p>
                  </div>
                </div>
                <Link
                  href="/work-order-requests"
                  className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  Review
                </Link>
              </div>
            ))}
            {pendingRequests.length > 5 && (
              <p className="text-center text-xs text-amber-600">
                +{pendingRequests.length - 5} more pending requests
              </p>
            )}
          </div>
        </div>
      )}

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
        </div>

        {canManage && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2">
            <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-sm"
            >
              {WO_STATUSES.map((s) => (
                <option key={s} value={s}>{WO_STATUS[s].label}</option>
              ))}
            </select>
            <button
              onClick={bulkUpdateStatus}
              disabled={bulkProcessing}
              className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkProcessing ? "Updating..." : "Update All"}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Wrench size={40} />} title="No work orders found" />
        ) : (
          <Table>
            <thead>
              <tr>
                {canManage && (
                  <Th>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300"
                      title="Select all"
                    />
                  </Th>
                )}
                <SortTh label="WO#" col="wo" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="PO#" col="po" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Work Order" col="title" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Vehicle" col="vehicle" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Mileage" col="mileage" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Material" col="material" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Labor" col="labor" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Total" col="total" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Status" col="status" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const cat = o.service?.category;
                return (
                  <tr key={o.id} className={`hover:bg-slate-50 ${selectedIds.has(o.id) ? "bg-blue-50" : ""}`}>
                    {canManage && (
                      <Td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </Td>
                    )}
                    <Td className="font-mono text-xs text-slate-500">{o.id.slice(-6).toUpperCase()}</Td>
                    <Td className="font-mono text-xs font-semibold text-slate-700">{o.poNumber ?? "—"}</Td>
                    <Td>
                      <p className="font-medium">{o.title}</p>
                      <p className="text-xs text-slate-400">
                        {cat ? SERVICE_CATEGORY[cat as keyof typeof SERVICE_CATEGORY].label + " · " : ""}
                        {titleCase(o.type)}
                      </p>
                      {!isVendor && o.assignedTo && (
                        <p className="text-xs font-medium text-blue-600">Assigned: {o.assignedTo.name}</p>
                      )}
                    </Td>
                    <Td className="text-slate-600">{o.vehicle?.name ?? o.vehicleOther ?? "—"}</Td>
                    <Td>
                      <Badge bg="#eef2ff" fg="#3730a3">{o.station}</Badge>
                    </Td>
                    <Td className="text-slate-600">
                      {o.odometerAt ? `${Number(o.odometerAt).toLocaleString()} mi` : <span className="text-slate-300">—</span>}
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
                      {IS_TROVA && o.status === "COMPLETED" && (o.vendor || o.assignedTo) && (
                        <span className="mt-1 block">
                          <Badge bg={o.vendorPaid ? "#dcfce7" : "#fef3c7"} fg={o.vendorPaid ? "#166534" : "#92400e"}>
                            {o.vendorPaid ? "Vendor paid" : "Vendor unpaid"}
                          </Badge>
                        </span>
                      )}
                    </Td>
                    <Td>
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(o)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => remove(o)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                      {isVendor && (
                        o.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <CheckCircle2 size={14} /> Done
                          </span>
                        ) : (
                          <button
                            onClick={() => setCompleting(o)}
                            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                          >
                            <CheckCircle2 size={14} /> Service Done
                          </button>
                        )
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
        title={editingId ? "Edit Work Order" : "New Work Order"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editingId ? "Save" : "Create"}</Button>
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

      {completing && (
        <ServiceDoneModal
          order={completing}
          performerName={performerName}
          onClose={() => setCompleting(null)}
          onSaved={() => { setCompleting(null); reload(); }}
        />
      )}
    </div>
  );
}

function ServiceDoneModal({
  order,
  performerName,
  onClose,
  onSaved,
}: {
  order: WorkOrderDTO;
  performerName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    completedAt: todayInputDate(),
    odometerAt: order.odometerAt != null ? String(order.odometerAt) : "",
    materialCost: order.materialCost ? String(order.materialCost) : "",
    serviceCost: order.laborCost ? String(order.laborCost) : "",
    poNumber: order.poNumber ?? "",
    invoiceNumber: order.invoiceNumber ?? "",
    description: order.description ?? order.title,
  });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = Number(form.materialCost || 0) + Number(form.serviceCost || 0);
  const valid =
    form.odometerAt !== "" &&
    form.materialCost !== "" &&
    form.serviceCost !== "" &&
    form.completedAt &&
    form.description.trim();

  async function submit() {
    setSaving(true);
    setError("");

    let invoiceUrl: string | undefined;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/uploads", { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        setSaving(false);
        setError((upData as { error?: string }).error ?? "Invoice upload failed");
        return;
      }
      invoiceUrl = (upData as { url: string }).url;
    }

    const res = await apiSend(`/api/maintenance/${order.id}`, "PATCH", {
      status: "COMPLETED",
      completedAt: form.completedAt,
      odometerAt: form.odometerAt,
      materialCost: form.materialCost,
      serviceCost: form.serviceCost,
      poNumber: form.poNumber.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      description: form.description.trim(),
      performedBy: performerName,
      ...(invoiceUrl ? { invoiceUrl } : {}),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      setError(res.error ?? "Failed to complete service");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Service Done"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !valid}>
            {file ? <Upload size={16} /> : <CheckCircle2 size={16} />}{" "}
            {saving ? "Saving…" : "Save & Log Service"}
          </Button>
        </>
      }
    >
      <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <p className="font-medium text-slate-800">{order.title}</p>
        <p className="text-xs text-slate-500">
          {order.vehicle?.name ?? order.vehicleOther ?? "—"} · {order.station}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date completed" required>
          <Input type="date" value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} />
        </Field>
        <Field label="Odometer" required>
          <Input type="number" min="0" value={form.odometerAt} onChange={(e) => setForm({ ...form, odometerAt: e.target.value })} />
        </Field>
        <Field label="Material cost ($)" required>
          <Input type="number" min="0" step="0.01" value={form.materialCost} onChange={(e) => setForm({ ...form, materialCost: e.target.value })} />
        </Field>
        <Field label="Service cost ($)" required>
          <Input type="number" min="0" step="0.01" value={form.serviceCost} onChange={(e) => setForm({ ...form, serviceCost: e.target.value })} />
        </Field>
        <Field label="PO / Work Order #">
          <Input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
        </Field>
        <Field label="Invoice #">
          <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
        </Field>
        <div className="col-span-2 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
          <span className="text-slate-500">Material {formatCurrency(Number(form.materialCost || 0))} + Service {formatCurrency(Number(form.serviceCost || 0))}</span>
          <span className="font-semibold">Total {formatCurrency(total)}</span>
        </div>
        <Field label="Service description" required className="col-span-2">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="col-span-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-muted)]">Invoice photo <span className="text-slate-400">(optional, max 5 MB)</span></span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
