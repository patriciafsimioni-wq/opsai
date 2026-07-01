"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Gauge,
  AlertOctagon,
  ShieldAlert,
  Filter,
} from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { ALERT_SEVERITY } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";

interface SafetyAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  read: boolean;
  createdAt: string;
  vehicleId: string | null;
  vehicleName: string | null;
  driverId: string | null;
  driverName: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  SPEEDING: "Speeding",
  HARSH_DRIVING: "Harsh Driving",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  SPEEDING: Gauge,
  HARSH_DRIVING: AlertOctagon,
};

export function SafetyClient({ alerts }: { alerts: SafetyAlert[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      return true;
    });
  }, [alerts, typeFilter, severityFilter]);

  const speedingCount = alerts.filter((a) => a.type === "SPEEDING").length;
  const harshCount = alerts.filter((a) => a.type === "HARSH_DRIVING").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Safety</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Driver safety events — speeding and harsh driving incidents.
        </p>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-400 uppercase">Total Events</p>
          <p className="mt-1 text-2xl font-bold">{alerts.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <Gauge size={14} className="text-amber-500" />
            <p className="text-xs font-medium text-slate-400 uppercase">Speeding</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{speedingCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <div className="flex items-center gap-2">
            <AlertOctagon size={14} className="text-red-500" />
            <p className="text-xs font-medium text-slate-400 uppercase">Harsh Driving</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-600">{harshCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-400 uppercase">Critical Events</p>
          <p className="mt-1 text-2xl font-bold text-red-700">
            {alerts.filter((a) => a.severity === "CRITICAL").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="all">All Types</option>
          <option value="SPEEDING">Speeding</option>
          <option value="HARSH_DRIVING">Harsh Driving</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="all">All Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} events</span>
      </div>

      {/* Events list */}
      <Card>
        <div className="divide-y divide-[var(--color-border)]">
          {filtered.length === 0 && (
            <EmptyState
              icon={<ShieldAlert size={32} />}
              title="No safety events"
              description="No safety events match your filters."
            />
          )}
          {filtered.map((a) => {
            const sev = ALERT_SEVERITY[a.severity as keyof typeof ALERT_SEVERITY] || ALERT_SEVERITY.WARNING;
            const Icon = TYPE_ICONS[a.type] || Gauge;
            const href = a.vehicleId
              ? `/vehicles/${a.vehicleId}`
              : a.driverId
                ? `/drivers/${a.driverId}`
                : "/safety";
            return (
              <Link
                key={a.id}
                href={href}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.message}</p>
                  <p className="text-xs text-slate-400">
                    {TYPE_LABELS[a.type] || a.type}
                    {a.vehicleName && ` · ${a.vehicleName}`}
                    {a.driverName && ` · ${a.driverName}`}
                    {" · "}
                    {relativeTime(new Date(a.createdAt))}
                  </p>
                </div>
                <Badge bg={sev.bg} fg={sev.fg}>
                  {sev.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
