"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, DollarSign, Clock } from "lucide-react";
import { useData, apiSend } from "@/lib/use-data";
import { Card, CardHeader, Badge, Button, EmptyState } from "@/components/ui";
import { Field, Select, Input, Modal } from "@/components/form";
import { formatCurrency, formatDate, todayInputDate } from "@/lib/utils";
import { STATIONS, PAYMENT_METHODS } from "@/lib/constants";

type VendorPaymentRow = {
  id: string;
  title: string;
  station: string;
  vendor: string | null;
  laborCost: number;
  poNumber: string | null;
  invoiceNumber: string | null;
  completedAt: string | null;
  createdAt: string;
  vendorPaid: boolean;
  vendorPaidAt: string | null;
  vendorPaymentMethod: string | null;
  vendorPaymentRef: string | null;
  vehicleOther: string | null;
  assignedTo: { name: string } | null;
  vehicle: { dxNumber: string | null; name: string | null } | null;
};

function vendorName(o: VendorPaymentRow): string {
  return (o.vendor || o.assignedTo?.name || "").trim();
}

export function VendorPaymentsClient() {
  const { data: orders, loading, reload } = useData<VendorPaymentRow[]>("/api/vendor-payments");

  const [vendorFilter, setVendorFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payTargets, setPayTargets] = useState<VendorPaymentRow[] | null>(null);
  const [payDate, setPayDate] = useState(todayInputDate());
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0]);
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Only completed work orders that have a vendor are payable.
  const payable = useMemo(() => {
    return (orders ?? []).filter((o) => vendorName(o) !== "");
  }, [orders]);

  const vendors = useMemo(
    () => Array.from(new Set(payable.map(vendorName))).sort((a, b) => a.localeCompare(b)),
    [payable],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payable
      .filter((o) => (vendorFilter ? vendorName(o) === vendorFilter : true))
      .filter((o) => (stationFilter ? o.station === stationFilter : true))
      .filter((o) => (statusFilter === "all" ? true : statusFilter === "paid" ? o.vendorPaid : !o.vendorPaid))
      .filter((o) => {
        if (!monthFilter) return true;
        const d = o.completedAt ?? o.createdAt;
        return d ? String(d).slice(0, 7) === monthFilter : false;
      })
      .filter((o) => {
        if (!q) return true;
        return (
          o.title.toLowerCase().includes(q) ||
          vendorName(o).toLowerCase().includes(q) ||
          (o.vehicle?.dxNumber ?? o.vehicle?.name ?? o.vehicleOther ?? "").toLowerCase().includes(q) ||
          (o.poNumber ?? "").toLowerCase().includes(q) ||
          (o.invoiceNumber ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(b.completedAt ?? b.createdAt).localeCompare(String(a.completedAt ?? a.createdAt)));
  }, [payable, vendorFilter, stationFilter, statusFilter, monthFilter, search]);

  // Totals over the current filter (labor/service cost only).
  const totals = useMemo(() => {
    let owed = 0;
    let paid = 0;
    for (const o of filtered) {
      if (o.vendorPaid) paid += o.laborCost;
      else owed += o.laborCost;
    }
    return { owed, paid };
  }, [filtered]);

  const selectableUnpaid = useMemo(() => filtered.filter((o) => !o.vendorPaid), [filtered]);
  const allSelected = selectableUnpaid.length > 0 && selectableUnpaid.every((o) => selected.has(o.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableUnpaid.map((o) => o.id)));
  }

  function openPay(targets: VendorPaymentRow[]) {
    setError("");
    setPayDate(todayInputDate());
    setPayMethod(PAYMENT_METHODS[0]);
    setPayRef("");
    setPayTargets(targets);
  }

  async function confirmPay() {
    if (!payTargets) return;
    setSaving(true);
    setError("");
    const results = await Promise.all(
      payTargets.map((o) =>
        apiSend(`/api/maintenance/${o.id}`, "PATCH", {
          vendorPaid: true,
          vendorPaidAt: payDate,
          vendorPaymentMethod: payMethod,
          vendorPaymentRef: payRef.trim() || null,
        }),
      ),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed) {
      setError(failed.error ?? "Failed to record payment");
      return;
    }
    setPayTargets(null);
    setSelected(new Set());
    reload();
  }

  async function markUnpaid(o: VendorPaymentRow) {
    const res = await apiSend(`/api/maintenance/${o.id}`, "PATCH", { vendorPaid: false });
    if (res.ok) reload();
  }

  const selectedOrders = useMemo(
    () => selectableUnpaid.filter((o) => selected.has(o.id)),
    [selectableUnpaid, selected],
  );
  const selectedTotal = selectedOrders.reduce((s, o) => s + o.laborCost, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Clock size={18} />} label="Owed (unpaid)" value={formatCurrency(totals.owed)} tone="amber" />
        <SummaryCard icon={<CheckCircle2 size={18} />} label="Paid" value={formatCurrency(totals.paid)} tone="green" />
        <SummaryCard icon={<DollarSign size={18} />} label="Total labor (filtered)" value={formatCurrency(totals.owed + totals.paid)} tone="slate" />
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Vendor">
            <Select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              options={[{ value: "", label: "All vendors" }, ...vendors.map((v) => ({ value: v, label: v }))]}
            />
          </Field>
          <Field label="Station">
            <Select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              options={[{ value: "", label: "All stations" }, ...STATIONS.map((s) => ({ value: s, label: s }))]}
            />
          </Field>
          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "unpaid" | "paid" | "all")}
              options={[
                { value: "unpaid", label: "Unpaid" },
                { value: "paid", label: "Paid" },
                { value: "all", label: "All" },
              ]}
            />
          </Field>
          <Field label="Month">
            <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          </Field>
          <Field label="Search">
            <Input placeholder="Vehicle, PO, invoice…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* Bulk action bar */}
      {selectedOrders.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedOrders.length} selected · {formatCurrency(selectedTotal)}
          </span>
          <Button onClick={() => openPay(selectedOrders)}>Mark selected as Paid</Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader title="Logged Services" subtitle={`${filtered.length} work order${filtered.length === 1 ? "" : "s"}`} />
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching work orders" description="Adjust the filters above to see vendor charges." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2">Vehicle</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Station</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Invoice / PO</th>
                  <th className="px-3 py-2 text-right">Labor</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      {!o.vendorPaid && (
                        <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Select ${o.title}`} />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{vendorName(o)}</td>
                    <td className="px-3 py-2">{o.vehicle?.dxNumber ?? o.vehicle?.name ?? o.vehicleOther ?? "—"}</td>
                    <td className="px-3 py-2">{o.title}</td>
                    <td className="px-3 py-2">{o.station}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(o.completedAt ?? o.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                      {o.invoiceNumber ? `#${o.invoiceNumber}` : ""}
                      {o.poNumber ? `${o.invoiceNumber ? " · " : ""}PO ${o.poNumber}` : ""}
                      {!o.invoiceNumber && !o.poNumber ? "—" : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(o.laborCost)}</td>
                    <td className="px-3 py-2">
                      {o.vendorPaid ? (
                        <Badge bg="#dcfce7" fg="#166534">
                          Paid {formatDate(o.vendorPaidAt)}{o.vendorPaymentMethod ? ` · ${o.vendorPaymentMethod}` : ""}
                        </Badge>
                      ) : (
                        <Badge bg="#fef3c7" fg="#92400e">Unpaid</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {o.vendorPaid ? (
                        <Button variant="ghost" size="sm" onClick={() => markUnpaid(o)}>Mark unpaid</Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => openPay([o])}>Mark paid</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Payment modal */}
      <Modal
        open={payTargets !== null}
        onClose={() => setPayTargets(null)}
        title={payTargets && payTargets.length > 1 ? `Record payment (${payTargets.length} services)` : "Record payment"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayTargets(null)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmPay} disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button>
          </>
        }
      >
        {payTargets && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Marking <span className="font-medium">{payTargets.length}</span> work order{payTargets.length === 1 ? "" : "s"} as paid ·{" "}
              <span className="font-medium">{formatCurrency(payTargets.reduce((s, o) => s + o.laborCost, 0))}</span>
              {payTargets.length === 1 ? ` to ${vendorName(payTargets[0])}` : ""}
            </p>
            <Field label="Payment date">
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <Field label="Method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
            </Field>
            <Field label="Reference (optional)">
              <Input placeholder="Check #, confirmation #, note…" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "amber" | "green" | "slate" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-green-200 bg-green-50 text-green-700",
    slate: "border-slate-200 bg-white text-slate-700",
  } as const;
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${tones[tone]}`}>
      <div className="rounded-lg bg-white/70 p-2">{icon}</div>
      <div>
        <p className="text-[11px] font-semibold uppercase">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}
