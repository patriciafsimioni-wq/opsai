"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Car, Paperclip, X } from "lucide-react";
import { Card, Button, Table, Th, Td, SortTh, EmptyState } from "@/components/ui";
import { Field, Input, Select, Textarea, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import { STATIONS, STATION_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type RentalVehicle = {
  id: string;
  vehicleName: string;
  rentalCompany: string | null;
  station: string | null;
  pickupDate: string | null;
  returnDate: string | null;
  amount: number | null;
  cost: number | null;
  invoiceUrls: string | null;
  notes: string | null;
};

const emptyForm = {
  vehicleName: "",
  rentalCompany: "",
  station: "",
  pickupDate: "",
  returnDate: "",
  amount: "",
  cost: "",
  notes: "",
  invoiceUrls: [] as string[],
};

function parseInvoices(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

export function RentalVehiclesClient({ canManage }: { canManage: boolean }) {
  const { data: rentals, loading, reload } = useData<RentalVehicle[]>("/api/rental-vehicles");
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RentalVehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const sort = useTableSort<RentalVehicle, "vehicle" | "company" | "station" | "pickup" | "return" | "amount" | "cost">(
    {
      vehicle: (r) => r.vehicleName.toLowerCase(),
      company: (r) => (r.rentalCompany ?? "").toLowerCase(),
      station: (r) => r.station ?? "",
      pickup: (r) => (r.pickupDate ? new Date(r.pickupDate).getTime() : 0),
      return: (r) => (r.returnDate ? new Date(r.returnDate).getTime() : 0),
      amount: (r) => r.amount ?? 0,
      cost: (r) => r.cost ?? 0,
    },
    "pickup",
    "desc",
  );

  const filtered = useMemo(() => {
    if (!rentals) return [];
    const q = search.toLowerCase();
    const result = rentals.filter((r) => {
      if (
        q &&
        !r.vehicleName.toLowerCase().includes(q) &&
        !(r.rentalCompany ?? "").toLowerCase().includes(q) &&
        !(r.notes ?? "").toLowerCase().includes(q)
      )
        return false;
      if (stationFilter !== "all" && r.station !== stationFilter) return false;
      return true;
    });
    return sort.sortRows(result);
  }, [rentals, search, stationFilter, sort]);

  const totalCost = useMemo(
    () => (rentals ?? []).reduce((sum, r) => sum + (r.cost ?? 0), 0),
    [rentals],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }
  function openEdit(r: RentalVehicle) {
    setEditing(r);
    setForm({
      vehicleName: r.vehicleName,
      rentalCompany: r.rentalCompany ?? "",
      station: r.station ?? "",
      pickupDate: r.pickupDate ? r.pickupDate.slice(0, 10) : "",
      returnDate: r.returnDate ? r.returnDate.slice(0, 10) : "",
      amount: r.amount != null ? String(r.amount) : "",
      cost: r.cost != null ? String(r.cost) : "",
      notes: r.notes ?? "",
      invoiceUrls: parseInvoices(r.invoiceUrls),
    });
    setError("");
    setModalOpen(true);
  }
  async function save() {
    if (!form.vehicleName.trim()) return setError("Vehicle is required");
    if (!form.station) return setError("Station is required");
    setSaving(true);
    setError("");
    const payload = {
      vehicleName: form.vehicleName,
      rentalCompany: form.rentalCompany,
      station: form.station,
      pickupDate: form.pickupDate || null,
      returnDate: form.returnDate || null,
      amount: form.amount === "" ? null : form.amount,
      cost: form.cost === "" ? null : form.cost,
      invoiceUrls: form.invoiceUrls,
      notes: form.notes,
    };
    const res = editing
      ? await apiSend(`/api/rental-vehicles/${editing.id}`, "PATCH", payload)
      : await apiSend("/api/rental-vehicles", "POST", payload);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      reload();
    } else setError(res.error ?? "Failed to save");
  }
  async function remove(r: RentalVehicle) {
    if (!confirm(`Delete rental "${r.vehicleName}"?`)) return;
    const res = await apiSend(`/api/rental-vehicles/${r.id}`, "DELETE");
    if (res.ok) reload();
    else alert(res.error);
  }

  async function uploadInvoice(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data as { url?: string }).url) {
      setForm((f) => ({ ...f, invoiceUrls: [...f.invoiceUrls, (data as { url: string }).url] }));
    } else {
      setError((data as { error?: string }).error ?? "Upload failed");
    }
    setUploading(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Rentals</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{rentals?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Cost</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">${totalCost.toLocaleString()}</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle, company, notes…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Stations</option>
            {STATIONS.map((s) => (
              <option key={s} value={s}>{STATION_LABEL[s] ?? s}</option>
            ))}
          </select>
          {canManage && (
            <Button onClick={openCreate}><Plus size={16} /> Add Rental</Button>
          )}
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Car size={40} />} title="No rental vehicles" description="Add a rented vehicle with its station, pickup/return dates, cost, and invoice photos." />
        ) : (
          <Table>
            <thead>
              <tr>
                <SortTh label="Vehicle" col="vehicle" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Rental Company" col="company" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Pickup" col="pickup" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Return" col="return" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Amount" col="amount" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Cost" col="cost" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <Th>Invoices</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const invoices = parseInvoices(r.invoiceUrls);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-800">
                      {r.vehicleName}
                      {r.notes && <span className="block text-xs text-slate-400">{r.notes}</span>}
                    </Td>
                    <Td className="text-slate-600">{r.rentalCompany || "—"}</Td>
                    <Td className="text-xs font-medium text-slate-600">{r.station || "—"}</Td>
                    <Td className="text-slate-600">{r.pickupDate ? formatDate(r.pickupDate) : "—"}</Td>
                    <Td className="text-slate-600">{r.returnDate ? formatDate(r.returnDate) : "—"}</Td>
                    <Td className="text-slate-700">{r.amount != null ? `$${r.amount.toLocaleString()}` : "—"}</Td>
                    <Td className="font-semibold text-slate-800">{r.cost != null ? `$${r.cost.toLocaleString()}` : "—"}</Td>
                    <Td>
                      {invoices.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {invoices.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                              <Paperclip size={13} /> {invoices.length > 1 ? `#${i + 1}` : "View"}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(r)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                          <button onClick={() => remove(r)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Rental Vehicle" : "Add Rental Vehicle"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vehicle" required className="col-span-2">
            <Input value={form.vehicleName} onChange={(e) => setForm({ ...form, vehicleName: e.target.value })} placeholder="e.g. Enterprise 26ft Box Truck — ABC1234" />
          </Field>
          <Field label="Rental Company">
            <Input value={form.rentalCompany} onChange={(e) => setForm({ ...form, rentalCompany: e.target.value })} placeholder="Enterprise, Penske, U-Haul…" />
          </Field>
          <Field label="Station" required>
            <Select
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              options={[{ value: "", label: "Select station…" }, ...STATIONS.map((s) => ({ value: s, label: STATION_LABEL[s] ?? s }))]}
            />
          </Field>
          <Field label="Pickup Date">
            <Input type="date" value={form.pickupDate} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} />
          </Field>
          <Field label="Return Date">
            <Input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} />
          </Field>
          <Field label="Amount ($)">
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Rental rate / charge" />
          </Field>
          <Field label="Total Cost ($)">
            <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="Total cost of rental" />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Reason for rental, contract #, etc." />
          </Field>
          <Field label="Invoice Photos / PDFs" className="col-span-2">
            <div className="space-y-2">
              {form.invoiceUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.invoiceUrls.map((url, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <Paperclip size={12} /> Invoice #{i + 1}
                      </a>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, invoiceUrls: f.invoiceUrls.filter((_, idx) => idx !== i) }))}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <label className="inline-block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50">
                {uploading ? "Uploading…" : "Upload invoice"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await uploadInvoice(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="text-xs text-slate-400">Add one invoice at a time — upload each charge for this rental.</p>
            </div>
          </Field>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}
