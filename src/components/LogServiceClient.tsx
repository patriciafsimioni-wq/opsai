"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, Lock, Upload, Pencil, X, Plus, Trash2, FileDown } from "lucide-react";
import { Card, CardHeader, Button, Badge, Table, Th, Td, SortTh, EmptyState } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import type { WorkOrderDTO, VehicleDTO, ServiceDTO } from "@/lib/types";
import { FORM_STATIONS, STATION_LABEL } from "@/lib/constants";
import { formatCurrency, formatDate, todayInputDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import { ServiceDetailModal } from "@/components/ServiceDetailModal";
import { compressImage } from "@/lib/image";

function todayStr() {
  return todayInputDate();
}

type ServiceLine = {
  category: string;
  serviceId: string;
  materialCost: string;
  serviceCost: string;
};

export function LogServiceClient({
  canManage,
  performerName,
}: {
  canManage: boolean;
  performerName: string;
}) {
  const { data: orders, loading, reload } = useData<WorkOrderDTO[]>("/api/maintenance");
  const { data: vehicles } = useData<VehicleDTO[]>(
    "/api/vehicles?fleet=1&allFleets=1",
  );
  const { data: services } = useData<ServiceDTO[]>("/api/services");
  const { data: providerList } = useData<{ id: string; name: string }[]>("/api/service-providers");
  const serviceProviders = useMemo(() => (providerList ?? []).map((p) => p.name), [providerList]);

  const initialForm = useMemo(
    () => ({
      station: FORM_STATIONS[0],
      vin: "",
      vehicleId: "",
      vehicleOther: "",
      odometer: "",
      serviceProvider: "" as string,
      serviceProviderOther: "",
      completedAt: todayStr(),
      poNumber: "",
      invoiceNumber: "",
      description: "",
    }),
    [],
  );

  const emptyLine = (): ServiceLine => ({
    category: "PREVENTIVE",
    serviceId: "",
    materialCost: "",
    serviceCost: "",
  });

  const [form, setForm] = useState(initialForm);
  // One or more service line items on a single invoice (shared vehicle, PO,
  // invoice #, date, provider, photo). Legacy single-service = one line.
  const [lines, setLines] = useState<ServiceLine[]>([emptyLine()]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const servicesForCategory = (cat: string) =>
    (services ?? []).filter((s) => s.category === cat).sort((a, b) => a.name.localeCompare(b.name));

  function updateLine(idx: number, patch: Partial<ServiceLine>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function selectLineService(idx: number, serviceId: string) {
    const svc = (services ?? []).find((s) => s.id === serviceId);
    updateLine(idx, {
      serviceId,
      materialCost: svc && !lines[idx].materialCost ? String(svc.materialCost) : lines[idx].materialCost,
      serviceCost: svc && !lines[idx].serviceCost ? String(svc.laborCost) : lines[idx].serviceCost,
    });
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()]);
  }

  function removeLine(idx: number) {
    setLines((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)));
  }
  useEffect(() => {
    if (serviceProviders.length > 0 && !form.serviceProvider) {
      setForm((f) => ({ ...f, serviceProvider: serviceProviders[0] }));
    }
  }, [serviceProviders]);

  function startEdit(o: WorkOrderDTO) {
    const parentCategory = o.service?.category ?? (o.type === "REPAIR" ? "CORRECTIVE" : "PREVENTIVE");
    const knownProvider = o.vendor && serviceProviders.includes(o.vendor);
    setForm({
      station: o.station ?? FORM_STATIONS[0],
      vin: o.vin ?? "",
      vehicleId: o.vehicleId ?? (o.vehicleOther ? "OTHER" : ""),
      vehicleOther: o.vehicleOther ?? "",
      odometer: o.odometerAt != null ? String(o.odometerAt) : "",
      serviceProvider: o.vendor ? (knownProvider ? o.vendor : "Other") : "",
      serviceProviderOther: o.vendor && !knownProvider ? o.vendor : "",
      completedAt: o.completedAt ? String(o.completedAt).slice(0, 10) : todayStr(),
      poNumber: o.poNumber ?? "",
      invoiceNumber: o.invoiceNumber ?? "",
      description: o.description ?? "",
    });
    // Rebuild the line items from the stored items, or fall back to the single
    // legacy service on older work orders.
    setLines(
      o.items && o.items.length > 0
        ? o.items.map((it) => ({
            category: it.service?.category ?? parentCategory,
            serviceId: it.serviceId ?? "",
            materialCost: String(it.materialCost ?? ""),
            serviceCost: String(it.laborCost ?? ""),
          }))
        : [{
            category: parentCategory,
            serviceId: o.serviceId ?? "",
            materialCost: String(o.materialCost ?? ""),
            serviceCost: String(o.laborCost ?? ""),
          }],
    );
    setEditingId(o.id);
    setError("");
    setSavedMsg("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...initialForm });
    setLines([emptyLine()]);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<WorkOrderDTO | null>(null);
  const [editParamHandled, setEditParamHandled] = useState(false);

  // Support deep-linking to edit a specific service (e.g. from a vehicle's
  // Maintenance History): /log-service?edit=<workOrderId>.
  useEffect(() => {
    if (editParamHandled || !orders) return;
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;
    const o = orders.find((x) => x.id === editId);
    if (o) {
      startEdit(o);
      setEditParamHandled(true);
    }
  }, [orders, editParamHandled]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = lines.reduce(
    (s, l) => s + Number(l.materialCost || 0) + Number(l.serviceCost || 0),
    0,
  );

  const sort = useTableSort<WorkOrderDTO, "service" | "vehicle" | "station" | "odometer" | "po" | "date" | "total">(
    {
      service: (o) => (o.title ?? "").toLowerCase(),
      vehicle: (o) => (o.vehicle?.name ?? o.vehicleOther ?? "").toLowerCase(),
      station: (o) => o.station ?? "",
      odometer: (o) => o.odometerAt ?? null,
      po: (o) => (o.poNumber ?? "").toLowerCase(),
      date: (o) => (o.completedAt ? new Date(o.completedAt).getTime() : null),
      total: (o) => o.cost,
    },
    "date",
    "desc",
  );

  const recent = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (orders ?? []).filter((o) => o.status === "COMPLETED");
    const filtered = q
      ? list.filter(
          (o) =>
            (o.title ?? "").toLowerCase().includes(q) ||
            (o.vehicle?.name ?? o.vehicleOther ?? "").toLowerCase().includes(q) ||
            (o.vendor ?? "").toLowerCase().includes(q) ||
            (o.poNumber ?? "").toLowerCase().includes(q) ||
            (o.station ?? "").toLowerCase().includes(q),
        )
      : list;
    return sort.sortRows(filtered);
  }, [orders, sort, search]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const allSelected = recent.length > 0 && recent.every((o) => selectedIds.has(o.id));
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(recent.map((o) => o.id)));
  }

  function downloadServices() {
    const rows = selectedIds.size > 0 ? recent.filter((o) => selectedIds.has(o.id)) : recent;
    if (rows.length === 0) return;
    const fmt = (d: string | Date | null | undefined) =>
      d ? new Date(d).toISOString().slice(0, 10) : "";
    downloadCsv(`logged-services-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: "Date", value: (o) => fmt(o.completedAt) },
      { header: "Service", value: (o) => o.title },
      { header: "Vehicle", value: (o) => o.vehicle?.name ?? o.vehicleOther ?? "" },
      { header: "VIN", value: (o) => o.vin ?? "" },
      { header: "Station", value: (o) => o.station ?? "" },
      { header: "Odometer", value: (o) => o.odometerAt ?? "" },
      { header: "Vendor", value: (o) => o.vendor ?? "" },
      { header: "PO", value: (o) => o.poNumber ?? "" },
      { header: "Invoice #", value: (o) => o.invoiceNumber ?? "" },
      { header: "Material", value: (o) => o.materialCost },
      { header: "Labor", value: (o) => o.laborCost },
      { header: "Total", value: (o) => o.cost },
      { header: "Description", value: (o) => o.description ?? "" },
    ]);
  }

  function onSelectVehicle(vehicleId: string) {
    const v = (vehicles ?? []).find((x) => x.id === vehicleId);
    setForm((f) => ({
      ...f,
      vehicleId,
      vin: v?.vin ?? f.vin,
      station: v?.station ?? f.station,
    }));
  }

  const serviceById = (id: string) => (services ?? []).find((s) => s.id === id);
  const firstService = serviceById(lines[0]?.serviceId ?? "");
  const provider =
    form.serviceProvider === "Other" ? form.serviceProviderOther.trim() : form.serviceProvider;

  const hasVehicle = form.vehicleId === "OTHER" ? form.vehicleOther.trim() : form.vehicleId;

  const linesValid = lines.every(
    (l) => l.serviceId && l.materialCost !== "" && l.serviceCost !== "",
  );

  const valid =
    form.station &&
    form.vin.trim() &&
    hasVehicle &&
    form.odometer !== "" &&
    provider &&
    form.completedAt &&
    form.poNumber.trim() &&
    form.invoiceNumber.trim() &&
    linesValid &&
    form.description.trim();

  const missingFields = [
    { ok: !!form.station, label: "Station" },
    { ok: !!hasVehicle, label: "Vehicle" },
    { ok: linesValid, label: "Each service line (service + costs)" },
    { ok: !!form.vin.trim(), label: "VIN" },
    { ok: form.odometer !== "", label: "Odometer" },
    { ok: !!provider, label: "Service provider" },
    { ok: !!form.completedAt, label: "Date" },
    { ok: !!form.poNumber.trim(), label: "PO number" },
    { ok: !!form.invoiceNumber.trim(), label: "Invoice number" },
    { ok: !!form.description.trim(), label: "Description" },
  ]
    .filter((f) => !f.ok)
    .map((f) => f.label);

  async function save() {
    setSaving(true);
    setError("");
    setSavedMsg("");

    let invoiceUrl: string | null = null;
    if (file) {
      const fd = new FormData();
      fd.append("file", await compressImage(file));
      const up = await fetch("/api/uploads", { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        setSaving(false);
        setError((upData as { error?: string }).error ?? "Invoice upload failed");
        return;
      }
      invoiceUrl = (upData as { url: string }).url;
    }

    const items = lines.map((l) => {
      const svc = serviceById(l.serviceId);
      return {
        serviceId: l.serviceId,
        title: svc?.name ?? form.description,
        materialCost: l.materialCost,
        laborCost: l.serviceCost,
      };
    });
    const multi = items.length > 1;
    const title = multi
      ? `${items[0].title} +${items.length - 1} more`
      : firstService?.name ?? form.description;
    // A single line still stores its cost on the parent (legacy shape); multiple
    // lines are persisted as items and rolled up server-side.
    const payload = {
      vehicleId: form.vehicleId === "OTHER" ? undefined : form.vehicleId,
      vehicleOther: form.vehicleId === "OTHER" ? form.vehicleOther.trim() : undefined,
      serviceId: lines[0]?.serviceId,
      station: form.station,
      type: (firstService?.category ?? lines[0]?.category) === "CORRECTIVE" ? "REPAIR" : "SCHEDULED_SERVICE",
      title,
      description: form.description,
      status: "COMPLETED",
      priority: "MEDIUM",
      materialCost: lines[0]?.materialCost,
      serviceCost: lines[0]?.serviceCost,
      vin: form.vin.trim(),
      odometerAt: form.odometer,
      vendor: provider,
      poNumber: form.poNumber.trim(),
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceUrl,
      performedBy: performerName,
      completedAt: form.completedAt,
      ...(multi || editingId ? { items } : {}),
    };
    const res = editingId
      ? await apiSend(`/api/maintenance/${editingId}`, "PATCH", {
          ...payload,
          ...(invoiceUrl ? { invoiceUrl } : {}),
        })
      : await apiSend("/api/maintenance", "POST", payload);
    setSaving(false);
    if (res.ok) {
      setSavedMsg(
        editingId
          ? `Updated "${payload.title}" — ${formatCurrency(total)}`
          : `Logged "${payload.title}" — ${formatCurrency(total)}`,
      );
      setEditingId(null);
      setForm({ ...initialForm });
      setLines([emptyLine()]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      reload();
    } else setError(res.error ?? (editingId ? "Failed to update service" : "Failed to log service"));
  }

  if (!canManage) {
    return (
      <Card>
        <EmptyState
          icon={<Lock size={40} />}
          title="Read-only access"
          description="Logging services requires a manager or admin role. Ask your administrator for access."
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader
          title={editingId ? "Edit Service Order" : "Maintenance / Repair Service Order"}
          subtitle={editingId ? "Update the service details below and save your changes." : "Add the service information below — read requirements with attention."}
          action={editingId ? (
            <Button variant="secondary" onClick={cancelEdit} className="h-8">
              <X size={14} /> Cancel edit
            </Button>
          ) : undefined}
        />
        <div className="space-y-4 p-5">
          <Field label="Station" required>
            <Select
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              options={FORM_STATIONS.map((s) => ({ value: s, label: STATION_LABEL[s] }))}
            />
          </Field>

          <Field label="DX Number or License Plate" required>
            <Select
              value={form.vehicleId}
              onChange={(e) => {
                if (e.target.value === "OTHER") {
                  setForm({ ...form, vehicleId: "OTHER", vin: "" });
                } else {
                  onSelectVehicle(e.target.value);
                }
              }}
              options={[
                { value: "", label: "Choose…" },
                ...(vehicles ?? []).map((v) => ({
                  value: v.id,
                  label: `${v.licensePlate} · ${v.name}`,
                })),
                { value: "OTHER", label: "Other (not listed)" },
              ]}
            />
          </Field>

          {form.vehicleId === "OTHER" && (
            <Field label="Vehicle Description" required>
              <Input
                value={form.vehicleOther}
                onChange={(e) => setForm({ ...form, vehicleOther: e.target.value })}
                placeholder="Enter vehicle name, plate, or description"
              />
            </Field>
          )}

          <Field label="VIN Number" required>
            <Input
              value={form.vin}
              onChange={(e) => setForm({ ...form, vin: e.target.value })}
              placeholder="Vehicle identification number"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-muted)]">
                Services on this invoice<span className="text-red-500"> *</span>
              </span>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus size={13} /> Add service
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Service {idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>
                <Field label="Service Category" required>
                  <Select
                    value={line.category}
                    onChange={(e) => updateLine(idx, { category: e.target.value, serviceId: "" })}
                    options={[
                      { value: "PREVENTIVE", label: "Preventive Maintenance" },
                      { value: "CORRECTIVE", label: "Corrective Maintenance" },
                    ]}
                  />
                </Field>
                <Field label="Service" required>
                  <Select
                    value={line.serviceId}
                    onChange={(e) => selectLineService(idx, e.target.value)}
                    options={[
                      { value: "", label: "Choose…" },
                      ...servicesForCategory(line.category).map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Material Cost ($)" required>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.materialCost}
                      onChange={(e) => updateLine(idx, { materialCost: e.target.value })}
                    />
                  </Field>
                  <Field label="Service Cost ($)" required>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.serviceCost}
                      onChange={(e) => updateLine(idx, { serviceCost: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <Field label="Odometer — all services must have the odometer recorded" required>
            <Input
              type="number"
              min="0"
              value={form.odometer}
              onChange={(e) => setForm({ ...form, odometer: e.target.value })}
            />
          </Field>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Service Provider<span className="text-red-500"> *</span>
            </span>
            <div className="space-y-1.5 pt-1">
              {serviceProviders.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="provider"
                    checked={form.serviceProvider === p}
                    onChange={() => setForm({ ...form, serviceProvider: p })}
                  />
                  {p}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="provider"
                  checked={form.serviceProvider === "Other"}
                  onChange={() => setForm({ ...form, serviceProvider: "Other" })}
                />
                Other:
                <Input
                  className="h-7"
                  value={form.serviceProviderOther}
                  onChange={(e) =>
                    setForm({ ...form, serviceProvider: "Other", serviceProviderOther: e.target.value })
                  }
                  disabled={form.serviceProvider !== "Other"}
                />
              </label>
            </div>
          </div>

          <Field label="Date" required>
            <Input
              type="date"
              value={form.completedAt}
              onChange={(e) => setForm({ ...form, completedAt: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Work Order Number if Approved — PO" required>
              <Input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
            </Field>
            <Field label="Invoice #" required>
              <Input
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold">
            <span>Total Cost</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <Field label="Service Description" required>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Invoice Picture <span className="text-slate-400">(max 10 MB)</span>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {savedMsg && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{savedMsg}</p>}
          {!valid && missingFields.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Complete these required fields to submit: {missingFields.join(", ")}
            </p>
          )}
          <Button onClick={save} disabled={saving || !valid} className="w-full">
            {file ? <Upload size={16} /> : <ClipboardCheck size={16} />}{" "}
            {saving ? (editingId ? "Saving…" : "Submitting…") : editingId ? "Save Changes" : "Submit"}
          </Button>
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader
          title="Logged services"
          subtitle={`${recent.length} service${recent.length === 1 ? "" : "s"} shown${selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}`}
          action={
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search service, vehicle, vendor, PO, station…"
                className="h-8 w-64"
              />
              <Button variant="secondary" onClick={downloadServices} disabled={recent.length === 0} className="h-8">
                <FileDown size={14} /> Download{selectedIds.size > 0 ? ` ${selectedIds.size}` : ""}
              </Button>
            </div>
          }
        />
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : recent.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={40} />} title={search ? "No services match your search" : "No services logged yet"} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300"
                      title="Select all"
                    />
                  </Th>
                  <SortTh label="Service" col="service" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Vehicle" col="vehicle" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Odometer" col="odometer" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="PO" col="po" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Date" col="date" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Total" col="total" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setDetail(o)}
                    className={`cursor-pointer hover:bg-slate-50 ${selectedIds.has(o.id) ? "bg-blue-50" : ""}`}
                  >
                    <Td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelect(o.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </Td>
                    <Td>
                      <p className="font-medium">{o.title}</p>
                      {o.vendor && <p className="text-xs text-slate-400">{o.vendor}</p>}
                    </Td>
                    <Td className="text-slate-600">{o.vehicle?.name ?? o.vehicleOther ?? "—"}</Td>
                    <Td>
                      <Badge bg="#eef2ff" fg="#3730a3">
                        {o.station}
                      </Badge>
                    </Td>
                    <Td className="text-slate-600">
                      {o.odometerAt != null ? o.odometerAt.toLocaleString() : "—"}
                    </Td>
                    <Td className="text-slate-600">{o.poNumber ?? "—"}</Td>
                    <Td className="text-slate-600">{formatDate(o.completedAt)}</Td>
                    <Td className="font-semibold">{formatCurrency(o.cost)}</Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startEdit(o)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <ServiceDetailModal order={detail} onClose={() => setDetail(null)} onEdit={startEdit} />
    </div>
  );
}
