"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Hexagon, Search } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, SortTh, EmptyState } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import type { GeofenceDTO } from "@/lib/types";
import { GEOFENCE_TYPE, GEOFENCE_TYPES } from "@/lib/constants";

const emptyForm = {
  name: "",
  type: "DEPOT",
  centerLat: "37.7749",
  centerLng: "-122.4194",
  radiusM: "500",
  color: "#2563eb",
};

export function GeofencesClient({ canManage }: { canManage: boolean }) {
  const { data: fences, loading, reload } = useData<GeofenceDTO[]>("/api/geofences");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GeofenceDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const sort = useTableSort<GeofenceDTO, "name" | "type" | "radius">(
    {
      name: (f) => f.name.toLowerCase(),
      type: (f) => GEOFENCE_TYPE[f.type as keyof typeof GEOFENCE_TYPE].label,
      radius: (f) => f.radiusM,
    },
    "name",
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = (fences ?? []).filter((f) => {
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      return true;
    });
    return sort.sortRows(result);
  }, [fences, search, typeFilter, sort]);

  function openCreate() { setEditing(null); setForm(emptyForm); setError(""); setModalOpen(true); }
  function openEdit(f: GeofenceDTO) {
    setEditing(f);
    setForm({
      name: f.name,
      type: f.type,
      centerLat: String(f.centerLat),
      centerLng: String(f.centerLng),
      radiusM: String(Math.round(f.radiusM)),
      color: f.color,
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = { ...form, color: GEOFENCE_TYPE[form.type as keyof typeof GEOFENCE_TYPE].color };
    const res = editing
      ? await apiSend(`/api/geofences/${editing.id}`, "PATCH", payload)
      : await apiSend("/api/geofences", "POST", payload);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      setForm(emptyForm);
      reload();
    } else setError(res.error ?? "Failed");
  }
  async function remove(f: GeofenceDTO) {
    if (!confirm(`Delete geofence "${f.name}"?`)) return;
    const res = await apiSend(`/api/geofences/${f.id}`, "DELETE");
    if (res.ok) reload();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search geofences…"
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
        >
          <option value="all">All Types</option>
          {GEOFENCE_TYPES.map((t) => <option key={t} value={t}>{GEOFENCE_TYPE[t].label}</option>)}
        </select>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Geofence
          </Button>
        )}
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Hexagon size={40} />} title="No geofences" />
      ) : (
        <Table>
          <thead>
            <tr>
              <SortTh label="Name" col="name" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Type" col="type" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <Th>Center</Th>
              <SortTh label="Radius" col="radius" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <Td>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: f.color }} />
                    {f.name}
                  </span>
                </Td>
                <Td>
                  <Badge>{GEOFENCE_TYPE[f.type as keyof typeof GEOFENCE_TYPE].label}</Badge>
                </Td>
                <Td className="text-slate-600">
                  {f.centerLat.toFixed(4)}, {f.centerLng.toFixed(4)}
                </Td>
                <Td className="text-slate-600">{Math.round(f.radiusM)} m</Td>
                <Td>
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(f)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(f)}
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
        title={editing ? "Edit Geofence" : "Add Geofence"}
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
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={GEOFENCE_TYPES.map((t) => ({ value: t, label: GEOFENCE_TYPE[t].label }))}
            />
          </Field>
          <Field label="Radius (m)">
            <Input type="number" value={form.radiusM} onChange={(e) => setForm({ ...form, radiusM: e.target.value })} />
          </Field>
          <Field label="Center Latitude">
            <Input type="number" step="0.0001" value={form.centerLat} onChange={(e) => setForm({ ...form, centerLat: e.target.value })} />
          </Field>
          <Field label="Center Longitude">
            <Input type="number" step="0.0001" value={form.centerLng} onChange={(e) => setForm({ ...form, centerLng: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </Card>
  );
}
