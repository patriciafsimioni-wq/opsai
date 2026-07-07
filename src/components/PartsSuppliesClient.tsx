"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Package, Paperclip } from "lucide-react";
import { Card, Button, Badge, Table, Th, Td, SortTh, EmptyState } from "@/components/ui";
import { Field, Input, Select, Textarea, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import { STATIONS, STATION_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type PartsExpense = {
  id: string;
  date: string;
  vendor: string;
  station: string | null;
  amount: number;
  category: string;
  description: string | null;
  poNumber: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
};

const CATEGORY_LABEL: Record<string, string> = { PARTS: "Parts", SUPPLIES: "Shop Supplies" };

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  vendor: "",
  station: "",
  amount: "",
  category: "PARTS",
  description: "",
  poNumber: "",
  invoiceNumber: "",
  invoiceUrl: "",
};

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export function PartsSuppliesClient({ canManage }: { canManage: boolean }) {
  const [year, setYear] = useState(currentYear);
  const { data: expenses, loading, reload } = useData<PartsExpense[]>(`/api/parts-expenses?year=${year}`);
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PartsExpense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const sort = useTableSort<PartsExpense, "date" | "vendor" | "category" | "station" | "po" | "amount">(
    {
      date: (e) => new Date(e.date).getTime(),
      vendor: (e) => e.vendor.toLowerCase(),
      category: (e) => CATEGORY_LABEL[e.category] ?? e.category,
      station: (e) => e.station ?? "",
      po: (e) => (e.poNumber ?? e.invoiceNumber ?? "").toLowerCase(),
      amount: (e) => e.amount,
    },
    "date",
    "desc",
  );

  const filtered = useMemo(() => {
    if (!expenses) return [];
    const q = search.toLowerCase();
    const result = expenses.filter((e) => {
      if (q && !e.vendor.toLowerCase().includes(q) && !(e.description ?? "").toLowerCase().includes(q) && !(e.poNumber ?? "").toLowerCase().includes(q)) return false;
      if (stationFilter === "shared" && e.station) return false;
      if (stationFilter !== "all" && stationFilter !== "shared" && e.station !== stationFilter) return false;
      return true;
    });
    return sort.sortRows(result);
  }, [expenses, search, stationFilter, sort]);

  const summary = useMemo(() => {
    const byStation: Record<string, number> = {};
    let total = 0, parts = 0, supplies = 0;
    for (const e of expenses ?? []) {
      const key = e.station || "Shared";
      byStation[key] = (byStation[key] || 0) + e.amount;
      total += e.amount;
      if (e.category === "SUPPLIES") supplies += e.amount; else parts += e.amount;
    }
    return { byStation, total, parts, supplies };
  }, [expenses]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }
  function openEdit(e: PartsExpense) {
    setEditing(e);
    setForm({
      date: e.date.slice(0, 10),
      vendor: e.vendor,
      station: e.station ?? "",
      amount: String(e.amount),
      category: e.category,
      description: e.description ?? "",
      poNumber: e.poNumber ?? "",
      invoiceNumber: e.invoiceNumber ?? "",
      invoiceUrl: e.invoiceUrl ?? "",
    });
    setError("");
    setModalOpen(true);
  }
  async function save() {
    setSaving(true);
    setError("");
    const res = editing
      ? await apiSend(`/api/parts-expenses/${editing.id}`, "PATCH", form)
      : await apiSend("/api/parts-expenses", "POST", form);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      reload();
    } else setError(res.error ?? "Failed to save");
  }
  async function remove(e: PartsExpense) {
    if (!confirm(`Delete this ${e.vendor} expense?`)) return;
    const res = await apiSend(`/api/parts-expenses/${e.id}`, "DELETE");
    if (res.ok) reload();
    else alert(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total {year}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">${summary.total.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Parts</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">${summary.parts.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Shop Supplies</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">${summary.supplies.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">By Station</p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {Object.entries(summary.byStation).map(([s, v]) => `${s}: $${v.toLocaleString()}`).join(" · ") || "—"}
          </p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor, PO, description…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500">
            <option value="all">All Stations</option>
            {STATIONS.map((s) => <option key={s} value={s}>{STATION_LABEL[s] ?? s}</option>)}
            <option value="shared">Shared / Unassigned</option>
          </select>
          {canManage && (
            <Button onClick={openCreate}><Plus size={16} /> Add Expense</Button>
          )}
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Package size={40} />} title="No parts & supplies expenses" description="Add a parts invoice (AutoZone, O'Reilly…) that isn't tied to a specific vehicle." />
        ) : (
          <Table>
            <thead>
              <tr>
                <SortTh label="Date" col="date" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Vendor" col="vendor" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Category" col="category" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="PO / Invoice" col="po" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Amount" col="amount" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <Th>Invoice</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td className="text-slate-600">{formatDate(e.date)}</Td>
                  <Td className="font-medium text-slate-800">{e.vendor}{e.description && <span className="block text-xs text-slate-400">{e.description}</span>}</Td>
                  <Td><Badge bg={e.category === "SUPPLIES" ? "#e0e7ff" : "#dbeafe"} fg={e.category === "SUPPLIES" ? "#3730a3" : "#1e40af"}>{CATEGORY_LABEL[e.category] ?? e.category}</Badge></Td>
                  <Td className="text-xs font-medium text-slate-600">{e.station || "Shared"}</Td>
                  <Td className="text-xs text-slate-500">{[e.poNumber, e.invoiceNumber].filter(Boolean).join(" / ") || "—"}</Td>
                  <Td className="font-semibold text-slate-800">${e.amount.toLocaleString()}</Td>
                  <Td>
                    {e.invoiceUrl ? (
                      <a href={e.invoiceUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <Paperclip size={13} /> View
                      </a>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </Td>
                  <Td>
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(e)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                        <button onClick={() => remove(e)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Parts & Supplies Expense" : "Add Parts & Supplies Expense"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Vendor" required>
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="AutoZone, O'Reilly…" />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[{ value: "PARTS", label: "Parts" }, { value: "SUPPLIES", label: "Shop Supplies" }]}
            />
          </Field>
          <Field label="Station">
            <Select
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              options={[{ value: "", label: "Shared / Unassigned" }, ...STATIONS.map((s) => ({ value: s, label: STATION_LABEL[s] ?? s }))]}
            />
          </Field>
          <Field label="Amount ($)" required>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="PO Number">
            <Input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
          </Field>
          <Field label="Invoice Number">
            <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
          </Field>
          <Field label="Description" className="col-span-2">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. brake pads, wiper fluid, shop rags…" />
          </Field>
          <Field label="Invoice Photo / PDF" className="col-span-2">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50">
                {uploading ? "Uploading…" : form.invoiceUrl ? "Replace file" : "Upload invoice"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/uploads", { method: "POST", body: fd });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && (data as { url?: string }).url) {
                      setForm((f) => ({ ...f, invoiceUrl: (data as { url: string }).url }));
                    } else {
                      setError((data as { error?: string }).error ?? "Upload failed");
                    }
                    setUploading(false);
                    e.target.value = "";
                  }}
                />
              </label>
              {form.invoiceUrl && (
                <a href={form.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Preview</a>
              )}
            </div>
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}
