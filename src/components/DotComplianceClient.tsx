"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, Truck, Pencil, FileDown, BellRing, BookOpen, ChevronDown, Upload, Paperclip } from "lucide-react";
import { Card, Table, Th, Td, Badge, EmptyState, Avatar, Button } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import type { DriverDTO, DotDocumentDTO, DotAuditDTO } from "@/lib/types";
import { formatDate, daysUntil } from "@/lib/utils";
import { DOT_STATE, DOT_FEDERAL_RULES, DOT_STATE_RULES, type DotRule } from "@/lib/constants";
import { compressImage } from "@/lib/image";

type UploadResult = { url: string } | { error: string };
// Serverless request bodies are capped (~4.5 MB); base64-persisting the file
// on save inflates it ~1.33×, so keep the raw file comfortably under that.
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_UPLOAD_LABEL = "about 3.5 MB";

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
  medicalCardDocUrl: "",
  licenseDocUrl: "",
  mvrDocUrl: "",
  drugTestDocUrl: "",
  annualReviewDocUrl: "",
};

type DocField = "medicalCardDocUrl" | "licenseDocUrl" | "mvrDocUrl" | "drugTestDocUrl" | "annualReviewDocUrl";

const DOC_FIELDS: DocField[] = ["medicalCardDocUrl", "licenseDocUrl", "mvrDocUrl", "drugTestDocUrl", "annualReviewDocUrl"];

function docsUploaded(d: DriverDTO): number {
  return DOC_FIELDS.filter((f) => !!(d[f] as string | null | undefined)).length;
}

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
  const [uploadingField, setUploadingField] = useState<DocField | null>(null);
  const { data: companyDocs, reload: reloadDocs } = useData<DotDocumentDTO[]>("/api/dot-documents");
  const [reqUploading, setReqUploading] = useState<string | null>(null);

  async function uploadFile(rawFile: File): Promise<UploadResult> {
    const file = await compressImage(rawFile).catch(() => rawFile);
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum is ${MAX_UPLOAD_LABEL}. Please compress the PDF or scan at a lower resolution.` };
    }
    const fd = new FormData();
    fd.append("file", file);
    let res: Response;
    try {
      res = await fetch("/api/uploads", { method: "POST", body: fd });
    } catch {
      return { error: "Upload failed — check your connection and try again." };
    }
    if (res.status === 413) return { error: `File is too large — the maximum is ${MAX_UPLOAD_LABEL}. Please compress the PDF and try again.` };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (data as { error?: string }).error ?? "Upload failed." };
    const url = (data as { url?: string }).url;
    return url ? { url } : { error: "Upload failed." };
  }

  async function uploadRequirementDoc(req: DotRule, rawFile: File) {
    setReqUploading(req.key);
    const result = await uploadFile(rawFile);
    if ("url" in result) {
      await apiSend("/api/dot-documents", "POST", { requirement: req.key, title: rawFile.name, docUrl: result.url });
      reloadDocs();
    } else {
      setError(result.error);
    }
    setReqUploading(null);
  }

  async function deleteRequirementDoc(id: string) {
    await apiSend(`/api/dot-documents/${id}`, "DELETE");
    reloadDocs();
  }

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
      medicalCardDocUrl: d.medicalCardDocUrl ?? "",
      licenseDocUrl: d.licenseDocUrl ?? "",
      mvrDocUrl: d.mvrDocUrl ?? "",
      drugTestDocUrl: d.drugTestDocUrl ?? "",
      annualReviewDocUrl: d.annualReviewDocUrl ?? "",
    });
    setError("");
    setUploadingField(null);
  }

  async function uploadDoc(field: DocField, rawFile: File) {
    setUploadingField(field);
    const result = await uploadFile(rawFile);
    setUploadingField(null);
    if ("url" in result) {
      setForm((f) => ({ ...f, [field]: result.url }));
    } else {
      setError(result.error);
    }
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
      medicalCardDocUrl: form.medicalCardDocUrl || null,
      licenseDocUrl: form.licenseDocUrl || null,
      mvrDocUrl: form.mvrDocUrl || null,
      drugTestDocUrl: form.drugTestDocUrl || null,
      annualReviewDocUrl: form.annualReviewDocUrl || null,
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
      else if (statuses.includes("missing") || !d.drugTestStatus || docsUploaded(d) < 5) missing++;
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
        if (statusFilter === "missing" && !statuses.includes("missing") && !!d.drugTestStatus && docsUploaded(d) === 5) return false;
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
            {[
              { title: "Federal FMCSA (49 CFR)", rows: DOT_FEDERAL_RULES.filter((r) => r.scope === "company") },
              { title: `${DOT_STATE.name} state requirements`, rows: DOT_STATE_RULES.filter((r) => r.scope === "company") },
            ].filter((grp) => grp.rows.length > 0).map((grp) => (
              <div key={grp.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{grp.title}</p>
                <div className="space-y-2">
                  {grp.rows.map((r) => {
                    const docs = (companyDocs ?? []).filter((d) => d.requirement === r.key);
                    return (
                      <div key={r.item} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{r.item}</p>
                          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{r.cadence}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{r.rule}</p>
                        {docs.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {docs.map((d) => (
                              <div key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs">
                                <a href={d.docUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate font-medium text-blue-700 hover:underline"><Paperclip size={12} /> {d.title}</a>
                                {canManage && <button onClick={() => deleteRequirementDoc(d.id)} className="shrink-0 text-red-600 hover:underline">Remove</button>}
                              </div>
                            ))}
                          </div>
                        )}
                        {canManage && (
                          <label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                            <Upload size={12} /> {reqUploading === r.key ? "Uploading…" : "Upload document"}
                            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={reqUploading !== null}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRequirementDoc(r, f); e.target.value = ""; }} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DotAuditsSection canManage={canManage} uploadFile={uploadFile} />

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
                <Th>Documents</Th>
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
                  <Td>
                    {(() => {
                      const n = docsUploaded(d);
                      const bg = n === 5 ? "#dcfce7" : n === 0 ? "#fee2e2" : "#fef9c3";
                      const fg = n === 5 ? "#166534" : n === 0 ? "#991b1b" : "#854d0e";
                      return <Badge bg={bg} fg={fg}>{n}/5 uploaded</Badge>;
                    })()}
                  </Td>
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

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded documents (image or PDF, max 5&nbsp;MB)</p>
          <div className="space-y-2">
            {([
              ["medicalCardDocUrl", "DOT Medical Card"],
              ["licenseDocUrl", "CDL / License"],
              ["mvrDocUrl", "MVR"],
              ["drugTestDocUrl", "Drug & Alcohol"],
              ["annualReviewDocUrl", "Annual Review"],
            ] as [DocField, string][]).map(([field, label]) => {
              const url = form[field];
              return (
                <div key={field} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <div className="flex items-center gap-2">
                    {url ? (
                      <>
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"><Paperclip size={13} /> View</a>
                        <button onClick={() => setForm((f) => ({ ...f, [field]: "" }))} className="text-xs text-red-600 hover:underline">Remove</button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">No file</span>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <Upload size={13} /> {uploadingField === field ? "Uploading…" : url ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={uploadingField !== null}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(field, f); e.target.value = ""; }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}

const AUDIT_RESULT: Record<string, { label: string; bg: string; fg: string }> = {
  SATISFACTORY: { label: "Satisfactory", bg: "#dcfce7", fg: "#166534" },
  CONDITIONAL: { label: "Conditional", bg: "#fef9c3", fg: "#854d0e" },
  UNSATISFACTORY: { label: "Unsatisfactory", bg: "#fee2e2", fg: "#991b1b" },
  NOT_RATED: { label: "Not rated", bg: "#f1f5f9", fg: "#475569" },
};

const emptyAudit = { auditDate: "", officerName: "", agency: "", result: "", notes: "", docUrl: "" };

function DotAuditsSection({ canManage, uploadFile }: { canManage: boolean; uploadFile: (f: File) => Promise<UploadResult> }) {
  const { data: audits, reload } = useData<DotAuditDTO[]>("/api/dot-audits");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAudit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const last = (audits ?? [])[0];

  function openNew() {
    setEditingId(null);
    setForm(emptyAudit);
    setError("");
    setOpen(true);
  }
  function openEdit(a: DotAuditDTO) {
    setEditingId(a.id);
    setForm({
      auditDate: a.auditDate ? a.auditDate.slice(0, 10) : "",
      officerName: a.officerName ?? "",
      agency: a.agency ?? "",
      result: a.result ?? "",
      notes: a.notes ?? "",
      docUrl: a.docUrl ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!form.auditDate) { setError("Audit date is required"); return; }
    setSaving(true);
    setError("");
    const payload = {
      auditDate: form.auditDate,
      officerName: form.officerName || null,
      agency: form.agency || null,
      result: form.result || null,
      notes: form.notes || null,
      docUrl: form.docUrl || null,
    };
    const res = editingId
      ? await apiSend(`/api/dot-audits/${editingId}`, "PATCH", payload)
      : await apiSend("/api/dot-audits", "POST", payload);
    setSaving(false);
    if (res.ok) { setOpen(false); setEditingId(null); setForm(emptyAudit); reload(); }
    else setError(res.error ?? "Failed to save");
  }
  async function remove(id: string) { await apiSend(`/api/dot-audits/${id}`, "DELETE"); reload(); }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><ShieldCheck size={16} /> DOT Audits</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {last ? <>Last audit: <span className="font-medium text-slate-700">{formatDate(last.auditDate)}</span>{last.officerName ? ` · ${last.officerName}` : ""}{last.agency ? ` (${last.agency})` : ""}</> : "No DOT audit logged yet"}
          </p>
        </div>
        {canManage && <Button onClick={openNew}>Log DOT audit</Button>}
      </div>

      {(audits ?? []).length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">No audits logged. Record when an officer last performed a DOT audit.</p>
      ) : (
        <Table>
          <thead>
            <tr><Th>Date</Th><Th>Officer</Th><Th>Agency</Th><Th>Result</Th><Th>Notes</Th><Th>Report</Th>{canManage && <Th />}</tr>
          </thead>
          <tbody>
            {(audits ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <Td className="font-medium text-slate-700">{formatDate(a.auditDate)}</Td>
                <Td className="text-sm text-slate-600">{a.officerName || "—"}</Td>
                <Td className="text-sm text-slate-600">{a.agency || "—"}</Td>
                <Td>{a.result ? <Badge bg={AUDIT_RESULT[a.result].bg} fg={AUDIT_RESULT[a.result].fg}>{AUDIT_RESULT[a.result].label}</Badge> : <span className="text-slate-400">—</span>}</Td>
                <Td className="text-sm text-slate-600"><span className="block max-w-[240px] truncate" title={a.notes ?? ""}>{a.notes || "—"}</span></Td>
                <Td>{a.docUrl ? <a href={a.docUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"><Paperclip size={13} /> View</a> : <span className="text-slate-400">—</span>}</Td>
                {canManage && <Td><div className="flex gap-3"><button onClick={() => openEdit(a)} className="text-xs font-medium text-blue-700 hover:underline">Edit</button><button onClick={() => remove(a.id)} className="text-xs text-red-600 hover:underline">Delete</button></div></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit DOT audit" : "Log DOT audit"}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Audit date">
            <Input type="date" value={form.auditDate} onChange={(e) => setForm({ ...form, auditDate: e.target.value })} />
          </Field>
          <Field label="Result">
            <Select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}
              options={[{ value: "", label: "Not set" }, ...Object.entries(AUDIT_RESULT).map(([value, m]) => ({ value, label: m.label }))]} />
          </Field>
          <Field label="Officer name">
            <Input value={form.officerName} onChange={(e) => setForm({ ...form, officerName: e.target.value })} placeholder="e.g. Officer J. Smith" />
          </Field>
          <Field label="Agency">
            <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} placeholder="e.g. FMCSA / State Police" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Findings, violations, follow-ups…" />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5">
          <span className="text-sm font-medium text-slate-700">Audit report (image or PDF)</span>
          <div className="flex items-center gap-2">
            {form.docUrl ? (
              <>
                <a href={form.docUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"><Paperclip size={13} /> View</a>
                <button onClick={() => setForm((f) => ({ ...f, docUrl: "" }))} className="text-xs text-red-600 hover:underline">Remove</button>
              </>
            ) : <span className="text-xs text-slate-400">No file</span>}
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Upload size={13} /> {uploading ? "Uploading…" : form.docUrl ? "Replace" : "Upload"}
              <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
                onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setError(""); setUploading(true); const result = await uploadFile(f); setUploading(false); if ("url" in result) setForm((s) => ({ ...s, docUrl: result.url })); else setError(result.error); }} />
            </label>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </Card>
  );
}
