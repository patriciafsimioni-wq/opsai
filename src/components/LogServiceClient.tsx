"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Lock } from "lucide-react";
import { Card, CardHeader, Button, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { WorkOrderDTO, VehicleDTO, ServiceDTO } from "@/lib/types";
import { STATIONS, STATION_LABEL, SERVICE_CATEGORY } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

const DEFAULT_RATE = "95";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function LogServiceClient({
  canManage,
  performerName,
}: {
  canManage: boolean;
  performerName: string;
}) {
  const { data: orders, loading, reload } = useData<WorkOrderDTO[]>("/api/maintenance");
  const { data: vehicles } = useData<VehicleDTO[]>("/api/vehicles");
  const { data: services } = useData<ServiceDTO[]>("/api/services");

  const initialForm = useMemo(
    () => ({
      vehicleId: "",
      serviceId: "",
      station: "AUS",
      title: "",
      description: "",
      materialCost: "0",
      laborHours: "0",
      laborRate: DEFAULT_RATE,
      performedBy: performerName,
      vendor: "",
      completedAt: todayStr(),
    }),
    [performerName],
  );

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const laborTotal = Number(form.laborHours || 0) * Number(form.laborRate || 0);
  const total = Number(form.materialCost || 0) + laborTotal;

  const recent = useMemo(
    () => (orders ?? []).filter((o) => o.status === "COMPLETED").slice(0, 12),
    [orders],
  );

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
      materialCost: String(svc.materialCost),
      laborRate: String(rate),
      laborHours: rate > 0 ? String(Math.round((svc.laborCost / rate) * 10) / 10) : "0",
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSavedMsg("");
    const svc = (services ?? []).find((s) => s.id === form.serviceId);
    const payload = {
      ...form,
      type: svc?.category === "CORRECTIVE" ? "REPAIR" : "SCHEDULED_SERVICE",
      status: "COMPLETED",
      priority: "MEDIUM",
    };
    const res = await apiSend("/api/maintenance", "POST", payload);
    setSaving(false);
    if (res.ok) {
      setSavedMsg(`Logged "${form.title}" — ${formatCurrency(total)}`);
      setForm({ ...initialForm });
      reload();
    } else setError(res.error ?? "Failed to log service");
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

  const valid = form.vehicleId && form.title;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Record a service" subtitle="Logged as completed for cost reporting." />
        <div className="space-y-4 p-5">
          <Field label="Vehicle" required>
            <Select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              options={[
                { value: "", label: "Select vehicle…" },
                ...(vehicles ?? []).map((v) => ({ value: v.id, label: `${v.name} · ${v.make} ${v.model}` })),
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
          <Field label="Service">
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
          <Field label="Title / description of work" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Material cost ($)">
              <Input type="number" min="0" value={form.materialCost} onChange={(e) => setForm({ ...form, materialCost: e.target.value })} />
            </Field>
            <Field label="Date performed">
              <Input type="date" value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} />
            </Field>
            <Field label="Labor hours">
              <Input type="number" min="0" step="0.1" value={form.laborHours} onChange={(e) => setForm({ ...form, laborHours: e.target.value })} />
            </Field>
            <Field label="Labor rate ($/hr)">
              <Input type="number" min="0" value={form.laborRate} onChange={(e) => setForm({ ...form, laborRate: e.target.value })} />
            </Field>
          </div>
          <div className="space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Material</span><span>{formatCurrency(Number(form.materialCost || 0))}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Labor ({form.laborHours || 0}h × {formatCurrency(Number(form.laborRate || 0))})</span>
              <span>{formatCurrency(laborTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Performed by">
              <Input value={form.performedBy} onChange={(e) => setForm({ ...form, performedBy: e.target.value })} />
            </Field>
            <Field label="Vendor / shop">
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {savedMsg && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{savedMsg}</p>}
          <Button onClick={save} disabled={saving || !valid} className="w-full">
            <ClipboardCheck size={16} /> {saving ? "Saving…" : "Log service"}
          </Button>
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="Recently logged services" />
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : recent.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={40} />} title="No services logged yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Vehicle</Th>
                <Th>Station</Th>
                <Th>Date</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-medium">{o.title}</p>
                    {o.performedBy && <p className="text-xs text-slate-400">by {o.performedBy}</p>}
                  </Td>
                  <Td className="text-slate-600">{o.vehicle.name}</Td>
                  <Td><Badge bg="#eef2ff" fg="#3730a3">{o.station}</Badge></Td>
                  <Td className="text-slate-600">{formatDate(o.completedAt)}</Td>
                  <Td className="font-semibold">{formatCurrency(o.cost)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
