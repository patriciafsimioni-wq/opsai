"use client";

import { useState } from "react";
import { Plus, Trash2, Hexagon } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
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
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    const res = await apiSend("/api/geofences", "POST", {
      ...form,
      color: GEOFENCE_TYPE[form.type as keyof typeof GEOFENCE_TYPE].color,
    });
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
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
        <p className="text-sm text-slate-500">
          {(fences ?? []).length} zones defined
        </p>
        {canManage && (
          <Button onClick={() => { setForm(emptyForm); setError(""); setModalOpen(true); }}>
            <Plus size={16} /> Add Geofence
          </Button>
        )}
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
      ) : (fences ?? []).length === 0 ? (
        <EmptyState icon={<Hexagon size={40} />} title="No geofences" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Center</Th>
              <Th>Radius</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {(fences ?? []).map((f) => (
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
                    <button
                      onClick={() => remove(f)}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Geofence"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
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
