"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2, Users, Star } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, EmptyState, Avatar } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { DriverDTO } from "@/lib/types";
import { DRIVER_STATUS, DRIVER_STATUSES } from "@/lib/constants";
import { formatDate, daysUntil } from "@/lib/utils";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  licenseNumber: "",
  licenseClass: "C",
  licenseExpiry: "",
  status: "ACTIVE",
  rating: "4.5",
  safetyScore: "85",
};

export function DriversClient({ canManage }: { canManage: boolean }) {
  const { data: drivers, loading, reload } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DriverDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!drivers) return [];
    const q = search.toLowerCase();
    return drivers.filter(
      (d) =>
        !q ||
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.licenseNumber.toLowerCase().includes(q),
    );
  }, [drivers, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }
  function openEdit(d: DriverDTO) {
    setEditing(d);
    setForm({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone ?? "",
      licenseNumber: d.licenseNumber,
      licenseClass: d.licenseClass ?? "C",
      licenseExpiry: d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : "",
      status: d.status,
      rating: String(d.rating),
      safetyScore: String(d.safetyScore),
    });
    setError("");
    setModalOpen(true);
  }
  async function save() {
    setSaving(true);
    setError("");
    const res = editing
      ? await apiSend(`/api/drivers/${editing.id}`, "PATCH", form)
      : await apiSend("/api/drivers", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      reload();
    } else setError(res.error ?? "Failed to save");
  }
  async function remove(d: DriverDTO) {
    if (!confirm(`Delete ${d.firstName} ${d.lastName}?`)) return;
    const res = await apiSend(`/api/drivers/${d.id}`, "DELETE");
    if (res.ok) reload();
    else alert(res.error);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers…"
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Driver
          </Button>
        )}
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="No drivers found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Driver</Th>
              <Th>Status</Th>
              <Th>License</Th>
              <Th>Expiry</Th>
              <Th>Rating</Th>
              <Th>Safety</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const exp = daysUntil(d.licenseExpiry);
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/drivers/${d.id}`} className="flex items-center gap-3">
                      <Avatar name={`${d.firstName} ${d.lastName}`} color={d.avatarColor} size={36} />
                      <div>
                        <p className="font-medium text-blue-700 hover:underline">
                          {d.firstName} {d.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{d.email}</p>
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <Badge
                      bg={DRIVER_STATUS[d.status as keyof typeof DRIVER_STATUS].bg}
                      fg={DRIVER_STATUS[d.status as keyof typeof DRIVER_STATUS].fg}
                    >
                      {DRIVER_STATUS[d.status as keyof typeof DRIVER_STATUS].label}
                    </Badge>
                  </Td>
                  <Td className="text-slate-600">
                    {d.licenseNumber}
                    <span className="ml-1 text-xs text-slate-400">Cl. {d.licenseClass}</span>
                  </Td>
                  <Td>
                    <span className={exp != null && exp < 30 ? "text-red-600" : "text-slate-600"}>
                      {formatDate(d.licenseExpiry)}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      {d.rating.toFixed(1)}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          d.safetyScore >= 85 ? "#16a34a" : d.safetyScore >= 70 ? "#d97706" : "#dc2626",
                      }}
                    >
                      {d.safetyScore}
                    </span>
                  </Td>
                  <Td>
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(d)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(d)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Driver" : "Add Driver"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" required>
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last Name" required>
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="License Number" required>
            <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
          </Field>
          <Field label="License Class">
            <Select
              value={form.licenseClass}
              onChange={(e) => setForm({ ...form, licenseClass: e.target.value })}
              options={["A", "B", "C"].map((c) => ({ value: c, label: `Class ${c}` }))}
            />
          </Field>
          <Field label="License Expiry" required>
            <Input type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={DRIVER_STATUSES.map((s) => ({ value: s, label: DRIVER_STATUS[s].label }))}
            />
          </Field>
          <Field label="Rating (0-5)">
            <Input type="number" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
          </Field>
          <Field label="Safety Score (0-100)">
            <Input type="number" value={form.safetyScore} onChange={(e) => setForm({ ...form, safetyScore: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </Card>
  );
}
