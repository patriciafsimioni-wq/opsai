"use client";

import { Badge } from "@/components/ui";
import { Modal } from "@/components/form";
import type { WorkOrderDTO } from "@/lib/types";
import { WO_STATUS, PRIORITY, titleCase } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

/** A work order as loaded either from the API (with its vehicle) or from a
 *  vehicle page (where the vehicle is already the page's subject). */
export type ServiceDetailOrder = Omit<WorkOrderDTO, "vehicle"> & {
  vehicle?: WorkOrderDTO["vehicle"] | null;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

const dash = (v: string | null | undefined) =>
  v && String(v).trim() ? v : <span className="text-slate-300">—</span>;

/** Everything recorded about one logged service / work order, including each
 *  service line on a multi-service invoice. Shared by Log Service and a
 *  vehicle's Maintenance History. */
export function ServiceDetailModal<T extends ServiceDetailOrder>({
  order,
  onClose,
  onEdit,
}: {
  order: T | null;
  onClose: () => void;
  onEdit?: (o: T) => void;
}) {
  if (!order) return null;
  const o = order;
  const status = WO_STATUS[o.status as keyof typeof WO_STATUS];
  const priority = PRIORITY[o.priority as keyof typeof PRIORITY];
  const items = o.items ?? [];
  const lineTotal = items.reduce((s, it) => s + it.materialCost + it.laborCost, 0);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={o.title}
      footer={
        onEdit ? (
          <button
            onClick={() => {
              onEdit(o);
              onClose();
            }}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit this service
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <Badge bg={status.bg} fg={status.fg}>
              {status.label}
            </Badge>
          )}
          {priority && (
            <Badge bg={priority.bg} fg={priority.fg}>
              {priority.label}
            </Badge>
          )}
          <Badge bg="#eef2ff" fg="#3730a3">
            {titleCase(o.type)}
          </Badge>
          {o.station && (
            <Badge bg="#f1f5f9" fg="#475569">
              {o.station}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Row label="Vehicle" value={dash(o.vehicle?.name ?? o.vehicleOther)} />
          <Row label="VIN" value={dash(o.vin ?? o.vehicle?.vin)} />
          <Row
            label="Odometer"
            value={o.odometerAt != null ? `${Number(o.odometerAt).toLocaleString()} mi` : dash(null)}
          />
          <Row label="Vendor" value={dash(o.vendor)} />
          <Row label="Performed by" value={dash(o.performedBy)} />
          <Row label="Requested by" value={dash(o.requestedBy)} />
          <Row label="PO #" value={dash(o.poNumber)} />
          <Row label="Invoice #" value={dash(o.invoiceNumber)} />
          <Row label="Assigned to" value={dash(o.assignedTo?.name)} />
          <Row label="Completed" value={o.completedAt ? formatDate(o.completedAt) : dash(null)} />
          <Row label="Scheduled" value={o.scheduledFor ? formatDate(o.scheduledFor) : dash(null)} />
          <Row label="Logged" value={formatDate(o.createdAt)} />
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Description</p>
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {o.description?.trim() || "No description recorded."}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
            {items.length > 1 ? `Services on this invoice (${items.length})` : "Cost"}
          </p>
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Service</th>
                  <th className="px-3 py-2 text-right font-medium">Material</th>
                  <th className="px-3 py-2 text-right font-medium">Labor</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((it) => (
                    <tr key={it.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-700">{it.title}</p>
                        {it.description && (
                          <p className="text-xs text-slate-400">{it.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(it.materialCost)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(it.laborCost)}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(it.materialCost + it.laborCost)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium text-slate-700">{o.service?.name ?? o.title}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(o.materialCost)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(o.laborCost)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(o.cost)}</td>
                  </tr>
                )}
                <tr className="border-t border-[var(--color-border)] bg-slate-50">
                  <td className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Total</td>
                  <td colSpan={2} className="px-3 py-2 text-right text-xs text-slate-400">
                    {o.laborHours ? `${o.laborHours} hrs @ ${formatCurrency(o.laborRate)}/hr` : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(items.length > 0 ? lineTotal : o.cost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {(o.vendorPaid || o.vendorPaymentMethod || o.vendorPaymentRef) && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Row
              label="Vendor payment"
              value={o.vendorPaid ? `Paid${o.vendorPaidAt ? ` · ${formatDate(o.vendorPaidAt)}` : ""}` : "Unpaid"}
            />
            <Row label="Method" value={dash(o.vendorPaymentMethod)} />
            <Row label="Reference" value={dash(o.vendorPaymentRef)} />
          </div>
        )}

        {o.invoiceUrl && (
          <a
            href={o.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            View attached invoice / photo
          </a>
        )}
      </div>
    </Modal>
  );
}
