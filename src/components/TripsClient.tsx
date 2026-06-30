"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Route } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { Field, Input, Select, Textarea, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { TripDTO, VehicleDTO, DriverDTO } from "@/lib/types";
import { TRIP_STATUS, TRIP_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

const emptyForm = {
  vehicleId: "",
  driverId: "",
  origin: "",
  destination: "",
  scheduledStart: "",
  distanceKm: "0",
  cargo: "",
  notes: "",
};

export function TripsClient({ canManage }: { canManage: boolean }) {
  const { data: trips, loading, reload } = useData<TripDTO[]>("/api/trips");
  const { data: vehicles } = useData<VehicleDTO[]>("/api/vehicles");
  const { data: drivers } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!trips) return [];
    const q = search.toLowerCase();
    return trips.filter((t) => {
      const matchSearch =
        !q ||
        t.origin.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        t.vehicle.name.toLowerCase().includes(q);
      return matchSearch && (!statusFilter || t.status === statusFilter);
    });
  }, [trips, search, statusFilter]);

  async function save() {
    setSaving(true);
    setError("");
    const res = await apiSend("/api/trips", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      setForm(emptyForm);
      reload();
    } else setError(res.error ?? "Failed");
  }
  async function setStatus(t: TripDTO, status: string) {
    const res = await apiSend(`/api/trips/${t.id}`, "PATCH", { status });
    if (res.ok) reload();
  }
  async function remove(t: TripDTO) {
    if (!confirm("Delete this trip?")) return;
    const res = await apiSend(`/api/trips/${t.id}`, "DELETE");
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
            placeholder="Search trips…"
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {TRIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRIP_STATUS[s].label}
            </option>
          ))}
        </select>
        {canManage && (
          <Button onClick={() => { setForm(emptyForm); setError(""); setModalOpen(true); }}>
            <Plus size={16} /> New Trip
          </Button>
        )}
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Route size={40} />} title="No trips found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Route</Th>
              <Th>Vehicle</Th>
              <Th>Driver</Th>
              <Th>Scheduled</Th>
              <Th>Distance</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <Td>
                  <p className="font-medium">{t.origin} → {t.destination}</p>
                  {t.cargo && <p className="text-xs text-slate-400">{t.cargo}</p>}
                </Td>
                <Td className="text-slate-600">{t.vehicle.name}</Td>
                <Td className="text-slate-600">
                  {t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : "—"}
                </Td>
                <Td className="text-slate-600">{formatDateTime(t.scheduledStart)}</Td>
                <Td>{Math.round(t.distanceKm)} mi</Td>
                <Td>
                  {canManage ? (
                    <select
                      value={t.status}
                      onChange={(e) => setStatus(t, e.target.value)}
                      className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
                    >
                      {TRIP_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TRIP_STATUS[s].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      bg={TRIP_STATUS[t.status as keyof typeof TRIP_STATUS].bg}
                      fg={TRIP_STATUS[t.status as keyof typeof TRIP_STATUS].fg}
                    >
                      {TRIP_STATUS[t.status as keyof typeof TRIP_STATUS].label}
                    </Badge>
                  )}
                </Td>
                <Td>
                  {canManage && (
                    <button
                      onClick={() => remove(t)}
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
        title="New Trip"
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
          <Field label="Driver">
            <Select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              options={[
                { value: "", label: "Unassigned" },
                ...(drivers ?? []).map((d) => ({ value: d.id, label: `${d.firstName} ${d.lastName}` })),
              ]}
            />
          </Field>
          <Field label="Origin" required>
            <Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
          </Field>
          <Field label="Destination" required>
            <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          </Field>
          <Field label="Scheduled Start" required>
            <Input
              type="datetime-local"
              value={form.scheduledStart}
              onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
            />
          </Field>
          <Field label="Distance (mi)">
            <Input type="number" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} />
          </Field>
          <Field label="Cargo" className="col-span-2">
            <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </Card>
  );
}
