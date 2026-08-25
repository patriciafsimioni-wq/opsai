"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Table, Td, Th } from "@/components/ui";
import { ServiceDetailModal, type ServiceDetailOrder } from "@/components/ServiceDetailModal";
import { WO_STATUS, PRIORITY, titleCase } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

export type MaintenanceHistoryRow = {
  order: ServiceDetailOrder;
  /** Odometer interpolated from the vehicle's known readings when the work
   *  order has none. */
  estimatedOdometer: number | null;
};

export function VehicleMaintenanceHistory({ rows }: { rows: MaintenanceHistoryRow[] }) {
  const [detail, setDetail] = useState<ServiceDetailOrder | null>(null);

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Work Order</Th>
            <Th>Mileage</Th>
            <Th>Status</Th>
            <Th>Priority</Th>
            <Th>Cost</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ order: w, estimatedOdometer }) => (
            <tr
              key={w.id}
              onClick={() => setDetail(w)}
              className="cursor-pointer hover:bg-slate-50"
            >
              <Td>
                <p className="font-medium">{w.title}</p>
                <p className="text-xs text-slate-400">
                  {titleCase(w.type)}
                  {w.completedAt ? ` · ${formatDate(w.completedAt)}` : ""}
                </p>
              </Td>
              <Td className="text-slate-600">
                {w.odometerAt && w.odometerAt > 0 ? (
                  `${Number(w.odometerAt).toLocaleString()} mi`
                ) : estimatedOdometer !== null ? (
                  <span className="text-blue-500" title="Estimated from date">
                    ~{estimatedOdometer.toLocaleString()} mi
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </Td>
              <Td>
                <Badge
                  bg={WO_STATUS[w.status as keyof typeof WO_STATUS].bg}
                  fg={WO_STATUS[w.status as keyof typeof WO_STATUS].fg}
                >
                  {WO_STATUS[w.status as keyof typeof WO_STATUS].label}
                </Badge>
              </Td>
              <Td>
                <Badge
                  bg={PRIORITY[w.priority as keyof typeof PRIORITY].bg}
                  fg={PRIORITY[w.priority as keyof typeof PRIORITY].fg}
                >
                  {PRIORITY[w.priority as keyof typeof PRIORITY].label}
                </Badge>
              </Td>
              <Td>{formatCurrency(w.cost)}</Td>
              <Td onClick={(e) => e.stopPropagation()}>
                <Link
                  href={`/log-service?edit=${w.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Edit
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <ServiceDetailModal order={detail} onClose={() => setDetail(null)} />
    </>
  );
}
