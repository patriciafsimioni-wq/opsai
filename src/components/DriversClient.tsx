"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2, Users, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, SortTh, EmptyState, Avatar } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import type { DriverDTO } from "@/lib/types";
import { DRIVER_STATUS, DRIVER_STATUSES, STATIONS, STATION_LABEL } from "@/lib/constants";
import { formatDate, daysUntil } from "@/lib/utils";

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  CARGO_VAN: "Cargo Van",
  BOX_TRUCK: "Box Truck",
  TRACTOR_TRUCK: "Tractor Truck",
};

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
  station: "",
  vehicleType: "CARGO_VAN",
  medicalCardExpiry: "",
  mvrCheckedAt: "",
  drugTestStatus: "",
  annualReviewAt: "",
};

export function DriversClient({ canManage }: { canManage: boolean }) {
  const { data: drivers, loading, reload } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
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

  const stations = useMemo(() => {
    if (!drivers) return [];
    const s = new Set(drivers.map((d) => d.station).filter(Boolean));
    return Array.from(s).sort() as string[];
  }, [drivers]);

  const sort = useTableSort<DriverDTO, "name" | "station" | "vehicleType" | "status" | "license" | "expiry" | "score">(
    {
      name: (d) => `${d.firstName} ${d.lastName}`.toLowerCase(),
      station: (d) => (d.station ?? "").toLowerCase(),
      vehicleType: (d) => VEHICLE_TYPE_LABEL[d.vehicleType ?? ""] ?? "",
      status: (d) => d.status,
      license: (d) => d.licenseNumber.toLowerCase(),
      expiry: (d) => (d.licenseExpiry ? new Date(d.licenseExpiry).getTime() : null),
      score: (d) => d.safetyScore,
    },
    "name",
  );

  const filtered = useMemo(() => {
    if (!drivers) return [];
    const q = search.toLowerCase();
    const result = drivers.filter((d) => {
      if (q && !`${d.firstName} ${d.lastName}`.toLowerCase().includes(q) && !d.email.toLowerCase().includes(q) && !d.licenseNumber.toLowerCase().includes(q)) return false;
      if (stationFilter !== "all" && d.station !== stationFilter) return false;
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
    return sort.sortRows(result);
  }, [drivers, search, licenseFilter, stationFilter, sort]);

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
      station: d.station ?? "",
      vehicleType: d.vehicleType ?? "CARGO_VAN",
      medicalCardExpiry: d.medicalCardExpiry ? d.medicalCardExpiry.slice(0, 10) : "",
      mvrCheckedAt: d.mvrCheckedAt ? d.mvrCheckedAt.slice(0, 10) : "",
      drugTestStatus: d.drugTestStatus ?? "",
      annualReviewAt: d.annualReviewAt ? d.annualReviewAt.slice(0, 10) : "",
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
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
        >
          <option value="all">All Stations</option>
          {stations.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
              <SortTh label="Driver" col="name" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Vehicle Type" col="vehicleType" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Status" col="status" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="License" col="license" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Expiry" col="expiry" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Safety Score" col="score" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
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
                  <Td className="text-xs font-medium text-slate-600">{d.station || "—"}</Td>
                  <Td className="text-xs font-medium text-slate-600">{VEHICLE_TYPE_LABEL[d.vehicleType ?? ""] ?? "—"}</Td>
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
                    <span className={exp != null && exp < 0 ? "text-red-600 font-semibold" : exp != null && exp < 30 ? "text-amber-600 font-semibold" : "text-slate-600"}>
                      {formatDate(d.licenseExpiry)}
                      {exp != null && exp < 0 && <span className="ml-1 text-xs">(Expired)</span>}
                      {exp != null && exp >= 0 && exp <= 30 && <span className="ml-1 text-xs">({exp}d)</span>}
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
          <Field label="Station">
            <Select
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              options={[{ value: "", label: "— None —" }, ...STATIONS.map((s) => ({ value: s, label: STATION_LABEL[s] ?? s }))]}
            />
          </Field>
          <Field label="Vehicle Type">
            <Select
              value={form.vehicleType}
              onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
              options={Object.entries(VEHICLE_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
        </div>

        {(form.vehicleType === "BOX_TRUCK" || form.vehicleType === "TRACTOR_TRUCK") && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">DOT Compliance</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Medical Card Expiry">
                <Input type="date" value={form.medicalCardExpiry} onChange={(e) => setForm({ ...form, medicalCardExpiry: e.target.value })} />
              </Field>
              <Field label="MVR Last Checked">
                <Input type="date" value={form.mvrCheckedAt} onChange={(e) => setForm({ ...form, mvrCheckedAt: e.target.value })} />
              </Field>
              <Field label="Drug & Alcohol Status">
                <Select
                  value={form.drugTestStatus}
                  onChange={(e) => setForm({ ...form, drugTestStatus: e.target.value })}
                  options={[{ value: "", label: "— Not set —" }, { value: "PASS", label: "Pass" }, { value: "PENDING", label: "Pending" }, { value: "FAIL", label: "Fail" }]}
                />
              </Field>
              <Field label="Annual Review Date">
                <Input type="date" value={form.annualReviewAt} onChange={(e) => setForm({ ...form, annualReviewAt: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </Card>
  );
}
