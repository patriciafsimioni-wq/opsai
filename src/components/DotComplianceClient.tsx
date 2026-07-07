"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, Truck, Pencil, FileDown, BellRing, BookOpen, ChevronDown } from "lucide-react";
import { Card, Table, Th, Td, Badge, EmptyState, Avatar, Button } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { DriverDTO } from "@/lib/types";
import { formatDate, daysUntil } from "@/lib/utils";
import { DOT_STATE, DOT_FEDERAL_RULES, DOT_STATE_RULES } from "@/lib/constants";

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  BOX_TRUCK: "Box Truck",
  TRACTOR_TRUCK: "Tractor Truck",
};

type DateStatus = "valid" | "expiring" | "expired" | "missing";

function dateStatus(value?: string | null): DateStatus {
  if (!value) return "missing";
  const d = daysUntil(value);
  if (d == null) return "missing";
  if (d < 0) return "expired";
  if (d <= 30) return "expiring";
  return "valid";
}

function StatusCell({ value }: { value?: string | null }) {
  const s = dateStatus(value);
  const map: Record<DateStatus, { bg: string; fg: string; label: string }> = {
    valid: { bg: "#dcfce7", fg: "#166534", label: formatDate(value!) },
    expiring: { bg: "#fef9c3", fg: "#854d0e", label: `${formatDate(value!)} (${daysUntil(value!)}d)` },
    expired: { bg: "#fee2e2", fg: "#991b1b", label: `${formatDate(value!)} (Expired)` },
    missing: { bg: "#f1f5f9", fg: "#64748b", label: "Not set" },
  };
  const c = map[s];
  return <Badge bg={c.bg} fg={c.fg}>{c.label}</Badge>;
}

const DRUG_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  PASS: { bg: "#dcfce7", fg: "#166534", label: "Pass" },
  PENDING: { bg: "#fef9c3", fg: "#854d0e", label: "Pending" },
  FAIL: { bg: "#fee2e2", fg: "#991b1b", label: "Fail" },
};

const emptyForm = {
  medicalCardExpiry: "",
  licenseClass: "",
  licenseExpiry: "",
  mvrCheckedAt: "",
  drugTestStatus: "",
  annualReviewAt: "",
};

export function DotComplianceClient({ canManage = false }: { canManage?: boolean }) {
  const { data: drivers, loading, reload } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | "expiring" | "missing">("all");
  const [editing, setEditing] = useState<DriverDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  async function refreshAlerts() {
    setScanning(true);
    setScanResult(null);
    const res = await fetch("/api/alerts/compliance", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setScanning(false);
    if (res.ok) setScanResult(`${(data as { dotAlerts?: number }).dotAlerts ?? 0} new DOT alert(s) opened`);
    else setScanResult("Failed to refresh alerts");
    setTimeout(() => setScanResult(null), 6000);
  }

  function openEdit(d: DriverDTO) {
    setEditing(d);
    setForm({
      medicalCardExpiry: d.medicalCardExpiry ? d.medicalCardExpiry.slice(0, 10) : "",
      licenseClass: d.licenseClass ?? "",
      licenseExpiry: d.licenseExpiry ? d.licenseExpiry.slice(0, 10) : "",
      mvrCheckedAt: d.mvrCheckedAt ? d.mvrCheckedAt.slice(0, 10) : "",
      drugTestStatus: d.drugTestStatus ?? "",
      annualReviewAt: d.annualReviewAt ? d.annualReviewAt.slice(0, 10) : "",
    });
    setError("");
  }
  async function save() {
    if (!editing) return;
    setSaving(true);
    setError("");
    const res = await apiSend(`/api/drivers/${editing.id}`, "PATCH", {
      medicalCardExpiry: form.medicalCardExpiry || null,
      licenseClass: form.licenseClass || null,
      licenseExpiry: form.licenseExpiry || undefined,
      mvrCheckedAt: form.mvrCheckedAt || null,
      drugTestStatus: form.drugTestStatus || null,
      annualReviewAt: form.annualReviewAt || null,
    });
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      reload();
    } else setError(res.error ?? "Failed to save");
  }

  const dotDrivers = useMemo(
    () => (drivers ?? []).filter((d) => d.vehicleType === "BOX_TRUCK" || d.vehicleType === "TRACTOR_TRUCK"),
    [drivers],
  );

  const counts = useMemo(() => {
    let expired = 0, expiring = 0, missing = 0;
    for (const d of dotDrivers) {
      const statuses = [dateStatus(d.medicalCardExpiry), dateStatus(d.licenseExpiry), dateStatus(d.annualReviewAt)];
      if (statuses.includes("expired")) expired++;
      else if (statuses.includes("expiring")) expiring++;
      else if (statuses.includes("missing") || !d.drugTestStatus) missing++;
    }
    return { expired, expiring, missing, total: dotDrivers.length };
  }, [dotDrivers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dotDrivers.filter((d) => {
      if (q && !`${d.firstName} ${d.lastName}`.toLowerCase().includes(q) && !d.email.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && d.vehicleType !== typeFilter) return false;
      if (statusFilter !== "all") {
        const statuses = [dateStatus(d.medicalCardExpiry), dateStatus(d.licenseExpiry), dateStatus(d.annualReviewAt)];
        if (statusFilter === "expired" && !statuses.includes("expired")) return false;
        if (statusFilter === "expiring" && !statuses.includes("expiring")) return false;
        if (statusFilter === "missing" && !statuses.includes("missing") && !!d.drugTestStatus) return false;
      }
      return true;
    });
  }, [dotDrivers, search, typeFilter, statusFilter]);

  const tiles: { key: typeof statusFilter; label: string; value: number; bg: string; fg: string }[] = [
    { key: "expired", label: "Expired", value: counts.expired, bg: "#fee2e2", fg: "#991b1b" },
    { key: "expiring", label: "Expiring ≤30d", value: counts.expiring, bg: "#fef9c3", fg: "#854d0e" },
    { key: "missing", label: "Missing info", value: counts.missing, bg: "#f1f5f9", fg: "#475569" },
    { key: "all", label: "DOT Drivers", value: counts.total, bg: "#dbeafe", fg: "#1e40af" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">
            <ShieldCheck size={16} /> {DOT_STATE.name} DOT rules ({DOT_STATE.code})
          </span>
          <span className="ml-2 text-xs text-slate-500">{DOT_STATE.agency}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scanResult && <span className="text-xs font-medium text-slate-600">{scanResult}</span>}
          {canManage && (
            <Button variant="secondary" onClick={refreshAlerts} disabled={scanning}>
              <BellRing size={15} /> {scanning ? "Scanning…" : "Refresh alerts"}
            </Button>
          )}
          <a href="/api/dot-compliance/audit" target="_blank" rel="noreferrer">
            <Button><FileDown size={15} /> Download audit packet</Button>
          </a>
        </div>
      </div>

      <Card>
        <button onClick={() => setRulesOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><BookOpen size={16} /> DOT compliance requirements — {DOT_STATE.name} &amp; federal (FMCSA)</span>
          <ChevronDown size={16} className={`text-slate-400 transition ${rulesOpen ? "rotate-180" : ""}`} />
        </button>
        {rulesOpen && (
          <div className="grid gap-4 border-t border-[var(--color-border)] p-4 lg:grid-cols-2">
            {[{ title: "Federal FMCSA (49 CFR)", rows: DOT_FEDERAL_RULES }, { title: `${DOT_STATE.name} state requirements`, rows: DOT_STATE_RULES }].map((grp) => (
              <div key={grp.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{grp.title}</p>
                <div className="space-y-2">
                  {grp.rows.map((r) => (
                    <div key={r.item} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{r.item}</p>
                        <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{r.cadence}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{r.rule}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={() => setStatusFilter(t.key)}
            className={`rounded-xl border p-4 text-left transition ${statusFilter === t.key ? "ring-2 ring-blue-500" : "border-slate-200"}`}
            style={{ background: t.bg }}
          >
            <p className="text-xs font-medium" style={{ color: t.fg }}>{t.label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: t.fg }}>{t.value}</p>
          </button>
        ))}
      </div>

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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Vehicle Types</option>
            <option value="BOX_TRUCK">Box Truck</option>
            <option value="TRACTOR_TRUCK">Tractor Truck</option>
          </select>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={40} />} title="No DOT drivers found" description="Set a driver's Vehicle Type to Box Truck or Tractor Truck to track DOT compliance." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Driver</Th>
                <Th>Station</Th>
                <Th>Vehicle Type</Th>
                <Th>Medical Card</Th>
                <Th>CDL / License</Th>
                <Th>MVR Checked</Th>
                <Th>Drug & Alcohol</Th>
                <Th>Annual Review</Th>
                {canManage && <Th />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/drivers/${d.id}`} className="flex items-center gap-3">
                      <Avatar name={`${d.firstName} ${d.lastName}`} color={d.avatarColor} size={32} />
                      <div>
                        <p className="font-medium text-blue-700 hover:underline">{d.firstName} {d.lastName}</p>
                        <p className="text-xs text-slate-400">{d.email}</p>
                      </div>
                    </Link>
                  </Td>
                  <Td className="text-xs font-medium text-slate-600">{d.station || "—"}</Td>
                  <Td className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Truck size={13} /> {VEHICLE_TYPE_LABEL[d.vehicleType ?? ""] ?? "—"}</span>
                  </Td>
                  <Td><StatusCell value={d.medicalCardExpiry} /></Td>
                  <Td>
                    <StatusCell value={d.licenseExpiry} />
                    {d.licenseClass && <span className="ml-1 text-xs text-slate-400">Cl. {d.licenseClass}</span>}
                  </Td>
                  <Td>{d.mvrCheckedAt ? <span className="text-sm text-slate-600">{formatDate(d.mvrCheckedAt)}</span> : <Badge bg="#f1f5f9" fg="#64748b">Not set</Badge>}</Td>
                  <Td>
                    {d.drugTestStatus ? (
                      <Badge bg={DRUG_STATUS[d.drugTestStatus].bg} fg={DRUG_STATUS[d.drugTestStatus].fg}>{DRUG_STATUS[d.drugTestStatus].label}</Badge>
                    ) : (
                      <Badge bg="#f1f5f9" fg="#64748b">Not set</Badge>
                    )}
                  </Td>
                  <Td><StatusCell value={d.annualReviewAt} /></Td>
                  {canManage && (
                    <Td>
                      <div className="flex justify-end">
                        <button onClick={() => openEdit(d)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit DOT info"><Pencil size={15} /></button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `DOT Info — ${editing.firstName} ${editing.lastName}` : "DOT Info"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Medical Card Expiry">
            <Input type="date" value={form.medicalCardExpiry} onChange={(e) => setForm({ ...form, medicalCardExpiry: e.target.value })} />
          </Field>
          <Field label="CDL / License Class">
            <Input value={form.licenseClass} onChange={(e) => setForm({ ...form, licenseClass: e.target.value })} placeholder="A, B, C…" />
          </Field>
          <Field label="License Expiry">
            <Input type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
          </Field>
          <Field label="MVR Checked">
            <Input type="date" value={form.mvrCheckedAt} onChange={(e) => setForm({ ...form, mvrCheckedAt: e.target.value })} />
          </Field>
          <Field label="Drug & Alcohol Status">
            <Select
              value={form.drugTestStatus}
              onChange={(e) => setForm({ ...form, drugTestStatus: e.target.value })}
              options={[{ value: "", label: "Not set" }, { value: "PASS", label: "Pass" }, { value: "PENDING", label: "Pending" }, { value: "FAIL", label: "Fail" }]}
            />
          </Field>
          <Field label="Annual Review">
            <Input type="date" value={form.annualReviewAt} onChange={(e) => setForm({ ...form, annualReviewAt: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}
