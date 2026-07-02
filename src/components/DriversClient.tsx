"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2, Users, RefreshCw, AlertTriangle } from "lucide-react";
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
  safetyScore: "85",
};

export function DriversClient({ canManage }: { canManage: boolean }) {
  const { data: drivers, loading, reload } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DriverDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function syncSamsaraDrivers() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/samsara/drivers", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error || "Sync failed"}`);
      } else {
        setSyncResult(`Created ${data.created}, updated ${data.updated} of ${data.samsaraDrivers} Samsara drivers`);
        reload();
      }
    } catch {
      setSyncResult("Error: Network request failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  }

  const filtered = useMemo(() => {
    if (!drivers) return [];
    const q = search.toLowerCase();
    const now = new Date();
    return drivers.filter((d) => {
      if (q && !`${d.firstName} ${d.lastName}`.toLowerCase().includes(q) && !d.email.toLowerCase().includes(q) && !d.licenseNumber.toLowerCase().includes(q)) return false;
      if (licenseFilter !== "all" && d.licenseExpiry) {
        const exp = daysUntil(d.licenseExpiry);
        if (exp == null) return licenseFilter === "valid";
        if (licenseFilter === "expired" && exp >= 0) return false;
        if (licenseFilter === "30days" && (exp < 0 || exp > 30)) return false;
        if (licenseFilter === "60days" && (exp < 0 || exp > 60)) return false;
        if (licenseFilter === "90days" && (exp < 0 || exp > 90)) return false;
        if (licenseFilter === "valid" && exp < 0) return false;
      }
      return true;
    });
  }, [drivers, search, licenseFilter]);

  const expiryCounts = useMemo(() => {
    if (!drivers) return { expired: 0, within30: 0, within60: 0, within90: 0 };
    let expired = 0, within30 = 0, within60 = 0, within90 = 0;
    for (const d of drivers) {
      const exp = daysUntil(d.licenseExpiry);
      if (exp == null) continue;
      if (exp < 0) expired++;
      else if (exp <= 30) within30++;
      else if (exp <= 60) within60++;
      else if (exp <= 90) within90++;
    }
    return { expired, within30, within60, within90 };
  }, [drivers]);

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
        <select
          value={licenseFilter}
          onChange={(e) => setLicenseFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
        >
          <option value="all">All Licenses</option>
          <option value="expired">Expired ({expiryCounts.expired})</option>
          <option value="30days">Expiring in 30 days ({expiryCounts.within30})</option>
          <option value="60days">Expiring in 60 days ({expiryCounts.within60})</option>
          <option value="90days">Expiring in 90 days ({expiryCounts.within90})</option>
          <option value="valid">Valid</option>
        </select>
        {canManage && (
          <>
            <Button variant="secondary" onClick={syncSamsaraDrivers} disabled={syncing}>
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Samsara"}
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Add Driver
            </Button>
          </>
        )}
      </div>

      {(expiryCounts.expired > 0 || expiryCounts.within30 > 0) && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            {expiryCounts.expired > 0 && <strong className="text-red-700">{expiryCounts.expired} expired</strong>}
            {expiryCounts.expired > 0 && expiryCounts.within30 > 0 && " and "}
            {expiryCounts.within30 > 0 && <strong>{expiryCounts.within30} expiring within 30 days</strong>}
          </span>
        </div>
      )}

      {syncResult && (
        <div className={`mx-4 mt-3 rounded-lg border px-4 py-2 text-sm ${syncResult.startsWith("Error") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {syncResult}
        </div>
      )}

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
              <Th>Safety Score</Th>
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
          <Field label="Safety Score (0-100)">
            <Input type="number" value={form.safetyScore} onChange={(e) => setForm({ ...form, safetyScore: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </Card>
  );
}
