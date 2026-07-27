"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Car, Paperclip, X, CalendarPlus, BellRing } from "lucide-react";
import { Card, Button, Table, Th, Td, SortTh, EmptyState } from "@/components/ui";
import { Field, Input, Select, Textarea, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import { STATIONS, STATION_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { compressImage } from "@/lib/image";

type Invoice = { amount: number | null; url: string | null; note: string | null };

type RentalVehicle = {
  id: string;
  vehicleName: string;
  rentalCompany: string | null;
  station: string | null;
  status: string;
  pickupDate: string | null;
  returnDate: string | null;
  cost: number | null;
  invoices: string | null;
  notes: string | null;
};

type FormInvoice = { amount: string; url: string | null; note: string };

const emptyForm = {
  vehicleName: "",
  rentalCompany: "",
  station: "",
  status: "ACTIVE",
  pickupDate: "",
  returnDate: "",
  notes: "",
  invoices: [] as FormInvoice[],
};

function parseInvoices(raw: string | null): Invoice[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((i): Invoice => {
      if (typeof i === "string") return { amount: null, url: i, note: null };
      const o = i as { amount?: unknown; url?: unknown; note?: unknown };
      return {
        amount: typeof o.amount === "number" ? o.amount : null,
        url: typeof o.url === "string" ? o.url : null,
        note: typeof o.note === "string" ? o.note : null,
      };
    });
  } catch {
    return [];
  }
}

export function RentalVehiclesClient({ canManage }: { canManage: boolean }) {
  const { data: rentals, loading, reload } = useData<RentalVehicle[]>("/api/rental-vehicles");
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RentalVehicle | null>(null);
  const [extendMode, setExtendMode] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const sort = useTableSort<RentalVehicle, "vehicle" | "company" | "station" | "status" | "pickup" | "return" | "cost">(
    {
      vehicle: (r) => r.vehicleName.toLowerCase(),
      company: (r) => (r.rentalCompany ?? "").toLowerCase(),
      station: (r) => r.station ?? "",
      status: (r) => r.status,
      pickup: (r) => (r.pickupDate ? new Date(r.pickupDate).getTime() : 0),
      return: (r) => (r.returnDate ? new Date(r.returnDate).getTime() : 0),
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
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
    return sort.sortRows(result);
  }, [rentals, search, stationFilter, statusFilter, sort]);

  const totalCost = useMemo(
    () => (rentals ?? []).reduce((sum, r) => sum + (r.cost ?? 0), 0),
    [rentals],
  );
  const activeCount = useMemo(
    () => (rentals ?? []).filter((r) => r.status === "ACTIVE").length,
    [rentals],
  );

  const formTotal = useMemo(
    () => form.invoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    [form.invoices],
  );

  function toForm(r: RentalVehicle): typeof emptyForm {
    return {
      vehicleName: r.vehicleName,
      rentalCompany: r.rentalCompany ?? "",
      station: r.station ?? "",
      status: r.status || "ACTIVE",
      pickupDate: r.pickupDate ? r.pickupDate.slice(0, 10) : "",
      returnDate: r.returnDate ? r.returnDate.slice(0, 10) : "",
      notes: r.notes ?? "",
      invoices: parseInvoices(r.invoices).map((i) => ({
        amount: i.amount != null ? String(i.amount) : "",
        url: i.url,
        note: i.note ?? "",
      })),
    };
  }

  function openCreate() {
    setEditing(null);
    setExtendMode(false);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }
  function openEdit(r: RentalVehicle) {
    setEditing(r);
    setExtendMode(false);
    setForm(toForm(r));
    setError("");
    setModalOpen(true);
  }
  function openExtend(r: RentalVehicle) {
    setEditing(r);
    setExtendMode(true);
    setForm({ ...toForm(r), status: "ACTIVE", invoices: [...toForm(r).invoices, { amount: "", url: null, note: "" }] });
    setError("");
    setModalOpen(true);
  }

  function addInvoiceRow() {
    setForm((f) => ({ ...f, invoices: [...f.invoices, { amount: "", url: null, note: "" }] }));
  }
  function updateInvoice(idx: number, patch: Partial<FormInvoice>) {
    setForm((f) => ({ ...f, invoices: f.invoices.map((inv, i) => (i === idx ? { ...inv, ...patch } : inv)) }));
  }
  function removeInvoice(idx: number) {
    setForm((f) => ({ ...f, invoices: f.invoices.filter((_, i) => i !== idx) }));
  }

  async function uploadInvoiceFile(idx: number, file: File) {
    setUploadingIdx(idx);
    const fd = new FormData();
    fd.append("file", await compressImage(file));
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data as { url?: string }).url) {
      updateInvoice(idx, { url: (data as { url: string }).url });
    } else {
      setError((data as { error?: string }).error ?? "Upload failed");
    }
    setUploadingIdx(null);
  }

  async function save() {
    if (!form.vehicleName.trim()) return setError("Vehicle is required");
    if (!form.station) return setError("Station is required");
    setSaving(true);
    setError("");
    const invoices = form.invoices
      .filter((i) => i.amount !== "" || i.url || i.note.trim())
      .map((i) => ({ amount: i.amount === "" ? null : i.amount, url: i.url, note: i.note.trim() || null }));
    const payload = {
      vehicleName: form.vehicleName,
      rentalCompany: form.rentalCompany,
      station: form.station,
      status: form.status,
      pickupDate: form.pickupDate || null,
      returnDate: form.returnDate || null,
      invoices,
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
  async function sendReminders() {
    if (!confirm("Email every station manager a reminder to upload the invoice for their station's current/latest rental vehicle?")) return;
    setReminding(true);
    setReminderMsg(null);
    const res = await apiSend("/api/rental-vehicles/remind", "POST");
    setReminding(false);
    if (res.ok && res.data) {
      const { sent, stationsWithoutManager, failed } = res.data as {
        sent: number;
        stationsWithRentals: number;
        stationsWithoutManager: string[];
        failed: number;
      };
      const parts = [`Reminder sent to ${sent} station manager${sent === 1 ? "" : "s"}.`];
      if (stationsWithoutManager.length) parts.push(`No station manager for: ${stationsWithoutManager.join(", ")}.`);
      if (failed) parts.push(`${failed} email${failed === 1 ? "" : "s"} failed to send.`);
      setReminderMsg({ ok: sent > 0, text: parts.join(" ") });
    } else {
      setReminderMsg({ ok: false, text: res.error ?? "Failed to send reminders" });
    }
  }

  async function remove(r: RentalVehicle) {
    if (!confirm(`Delete rental "${r.vehicleName}"?`)) return;
    const res = await apiSend(`/api/rental-vehicles/${r.id}`, "DELETE");
    if (res.ok) reload();
    else alert(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Rentals</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{rentals?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="RETURNED">Returned</option>
          </select>
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
            <>
              <Button variant="secondary" onClick={sendReminders} disabled={reminding} title="Email station managers to upload their rental invoices">
                <BellRing size={16} /> {reminding ? "Sending…" : "Send Reminders"}
              </Button>
              <Button onClick={openCreate}><Plus size={16} /> Add Rental</Button>
            </>
          )}
        </div>
        {reminderMsg && (
          <div className={`border-b border-[var(--color-border)] px-4 py-2 text-sm ${reminderMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {reminderMsg.text}
          </div>
        )}

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
                <SortTh label="Status" col="status" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Pickup" col="pickup" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Return" col="return" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <SortTh label="Total Cost" col="cost" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                <Th>Invoices</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const invoices = parseInvoices(r.invoices);
                const returned = r.status === "RETURNED";
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-800">
                      {r.vehicleName}
                      {r.notes && <span className="block text-xs text-slate-400">{r.notes}</span>}
                    </Td>
                    <Td className="text-slate-600">{r.rentalCompany || "—"}</Td>
                    <Td className="text-xs font-medium text-slate-600">{r.station || "—"}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${returned ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                        {returned ? "Returned" : "Active"}
                      </span>
                    </Td>
                    <Td className="text-slate-600">{r.pickupDate ? formatDate(r.pickupDate) : "—"}</Td>
                    <Td className="text-slate-600">{r.returnDate ? formatDate(r.returnDate) : "—"}</Td>
                    <Td className="font-semibold text-slate-800">{r.cost != null ? `$${r.cost.toLocaleString()}` : "—"}</Td>
                    <Td>
                      {invoices.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {invoices.map((inv, i) =>
                            inv.url ? (
                              <a key={i} href={inv.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline" title={inv.amount != null ? `$${inv.amount.toLocaleString()}` : undefined}>
                                <Paperclip size={13} /> {invoices.length > 1 ? `#${i + 1}` : "View"}
                              </a>
                            ) : (
                              <span key={i} className="text-xs text-slate-400" title={inv.note ?? undefined}>
                                {inv.amount != null ? `$${inv.amount.toLocaleString()}` : "—"}
                              </span>
                            ),
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          {!returned && (
                            <button onClick={() => openExtend(r)} title="Extend rental / add invoice" className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><CalendarPlus size={15} /></button>
                          )}
                          <button onClick={() => openEdit(r)} title="Edit" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                          <button onClick={() => remove(r)} title="Delete" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
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
        title={extendMode ? `Extend Rental — ${editing?.vehicleName ?? ""}` : editing ? "Edit Rental Vehicle" : "Add Rental Vehicle"}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : extendMode ? "Save Extension" : "Save"}</Button>
          </>
        }
      >
        {extendMode && (
          <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Extending this rental — update the <strong>return date</strong> and add the new invoice + amount below. Existing invoices are kept.
          </p>
        )}
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
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[{ value: "ACTIVE", label: "Active" }, { value: "RETURNED", label: "Returned" }]}
            />
          </Field>
          <Field label="Pickup Date">
            <Input type="date" value={form.pickupDate} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} />
          </Field>
          <Field label="Return Date">
            <Input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Reason for rental, contract #, etc." />
          </Field>
          <div className="col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Invoices / Charges</label>
              <span className="text-sm font-semibold text-slate-800">Total: ${formTotal.toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              {form.invoices.map((inv, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={inv.amount}
                      onChange={(e) => updateInvoice(i, { amount: e.target.value })}
                      placeholder="Amount"
                      className="h-8 w-28 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <input
                    value={inv.note}
                    onChange={(e) => updateInvoice(i, { note: e.target.value })}
                    placeholder="Note (optional)"
                    className="h-8 min-w-[120px] flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-500"
                  />
                  {inv.url ? (
                    <a href={inv.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                      <Paperclip size={13} /> View
                    </a>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-blue-400 hover:bg-blue-50">
                      {uploadingIdx === i ? "Uploading…" : "Upload invoice"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={uploadingIdx !== null}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await uploadInvoiceFile(i, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  <button type="button" onClick={() => removeInvoice(i)} className="ml-auto text-slate-400 hover:text-red-600"><X size={15} /></button>
                </div>
              ))}
              <button type="button" onClick={addInvoiceRow} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50">
                <Plus size={14} /> Add invoice
              </button>
              <p className="text-xs text-slate-400">Each charge = one invoice (amount + photo/PDF). Total cost is the sum of all amounts.</p>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  );
}
