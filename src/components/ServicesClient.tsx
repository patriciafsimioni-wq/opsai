"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, ListChecks, Building2 } from "lucide-react";
import { Card, CardHeader, Button, Badge, Table, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { ServiceDTO } from "@/lib/types";
import { SERVICE_CATEGORY, SERVICE_CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

const emptyForm = {
  name: "",
  category: "PREVENTIVE",
  group: "",
  materialCost: "0",
  laborCost: "0",
};

export function ServicesClient({ canManage }: { canManage: boolean }) {
  const { data: services, loading, reload } = useData<ServiceDTO[]>("/api/services");
  const { data: providers, reload: reloadProviders } = useData<{ id: string; name: string }[]>("/api/service-providers");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newProvider, setNewProvider] = useState("");
  const [providerError, setProviderError] = useState("");
  const [addingProvider, setAddingProvider] = useState(false);

  const filtered = useMemo(() => {
    if (!services) return [];
    const q = search.toLowerCase();
    return services.filter((s) => {
      const matchSearch =
        !q || s.name.toLowerCase().includes(q) || (s.group ?? "").toLowerCase().includes(q);
      return matchSearch && (!categoryFilter || s.category === categoryFilter);
    });
  }, [services, search, categoryFilter]);

  const stats = useMemo(() => {
    const list = services ?? [];
    return {
      total: list.length,
      preventive: list.filter((s) => s.category === "PREVENTIVE").length,
      corrective: list.filter((s) => s.category === "CORRECTIVE").length,
    };
  }, [services]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }
  function openEdit(s: ServiceDTO) {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      group: s.group ?? "",
      materialCost: String(s.materialCost),
      laborCost: String(s.laborCost),
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = editing
      ? await apiSend(`/api/services/${editing.id}`, "PATCH", form)
      : await apiSend("/api/services", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      reload();
    } else setError(res.error ?? "Failed");
  }
  async function remove(s: ServiceDTO) {
    if (!confirm(`Delete service "${s.name}"?`)) return;
    const res = await apiSend(`/api/services/${s.id}`, "DELETE");
    if (res.ok) reload();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Services" value={stats.total} icon={<ListChecks size={18} />} accent="#2563eb" />
        <StatCard label="Preventive" value={stats.preventive} icon={<ListChecks size={18} />} accent="#16a34a" />
        <StatCard label="Corrective" value={stats.corrective} icon={<ListChecks size={18} />} accent="#dc2626" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">All categories</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{SERVICE_CATEGORY[c].label}</option>
            ))}
          </select>
          {canManage && (
            <Button onClick={openNew}>
              <Plus size={16} /> New Service
            </Button>
          )}
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ListChecks size={40} />} title="No services found" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Category</Th>
                <Th>Group</Th>
                <Th>Material Cost</Th>
                <Th>Labor Cost</Th>
                <Th>Total</Th>
                <Th>Used</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="font-medium">{s.name}</Td>
                  <Td>
                    <Badge
                      bg={SERVICE_CATEGORY[s.category as keyof typeof SERVICE_CATEGORY].bg}
                      fg={SERVICE_CATEGORY[s.category as keyof typeof SERVICE_CATEGORY].fg}
                    >
                      {SERVICE_CATEGORY[s.category as keyof typeof SERVICE_CATEGORY].label}
                    </Badge>
                  </Td>
                  <Td className="text-slate-500">{s.group ?? "—"}</Td>
                  <Td className="text-slate-600">{formatCurrency(s.materialCost)}</Td>
                  <Td className="text-slate-600">{formatCurrency(s.laborCost)}</Td>
                  <Td className="font-semibold">{formatCurrency(s.materialCost + s.laborCost)}</Td>
                  <Td className="text-slate-500">{s._count?.workOrders ?? 0}</Td>
                  <Td>
                    {canManage && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(s)}
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
      </Card>

      {/* Service Providers Management */}
      {canManage && (
        <Card>
          <CardHeader
            title="Service Providers"
            subtitle="Manage vendors and service providers available in Log Service"
          />
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              <Input
                value={newProvider}
                onChange={(e) => { setNewProvider(e.target.value); setProviderError(""); }}
                placeholder="Enter new provider name…"
                className="flex-1"
              />
              <Button
                disabled={addingProvider || !newProvider.trim()}
                onClick={async () => {
                  setAddingProvider(true);
                  setProviderError("");
                  const res = await apiSend("/api/service-providers", "POST", { name: newProvider.trim() });
                  setAddingProvider(false);
                  if (res.ok) {
                    setNewProvider("");
                    reloadProviders();
                  } else {
                    setProviderError(res.error ?? "Failed to add");
                  }
                }}
              >
                <Plus size={16} /> Add
              </Button>
            </div>
            {providerError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{providerError}</p>
            )}
            <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
              {(providers ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No service providers yet.</p>
              ) : (
                (providers ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-slate-400" />
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete provider "${p.name}"?`)) return;
                        await apiSend("/api/service-providers", "DELETE", { id: p.id });
                        reloadProviders();
                      }}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Service" : "New Service"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Create"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" required className="col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Category" required>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={SERVICE_CATEGORIES.map((c) => ({ value: c, label: SERVICE_CATEGORY[c].label }))}
            />
          </Field>
          <Field label="Group">
            <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="e.g. Engine Services" />
          </Field>
          <Field label="Default material cost ($)">
            <Input type="number" min="0" value={form.materialCost} onChange={(e) => setForm({ ...form, materialCost: e.target.value })} />
          </Field>
          <Field label="Default labor cost ($)">
            <Input type="number" min="0" value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}
