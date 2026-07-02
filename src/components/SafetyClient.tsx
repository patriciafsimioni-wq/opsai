"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Gauge,
  AlertOctagon,
  ShieldAlert,
  Filter,
  RefreshCw,
  Loader2,
  Zap,
  TrendingDown,
} from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { ALERT_SEVERITY } from "@/lib/constants";
import { useData, apiSend } from "@/lib/use-data";
import { relativeTime, formatDate } from "@/lib/utils";

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

interface SamsaraEvent {
  id: string;
  time: string;
  behaviorLabel: string;
  vehicleName: string | null;
  driverName: string | null;
  maxG: number | null;
}

export function SafetyClient({ alerts }: { alerts: SafetyAlert[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [tab, setTab] = useState<"alerts" | "samsara">("alerts");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [days, setDays] = useState("7");
  const { data: samsaraData, loading: samsaraLoading, reload: refreshSamsara } = useData<{ events: SamsaraEvent[]; total: number }>(`/api/samsara/safety?days=${days}`);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await apiSend("/api/samsara/safety", "POST", {});
    setSyncing(false);
    if (res.ok) {
      const d = res.data as { scoresUpdated: number; alertsCreated: number; recentEvents: number };
      setSyncResult(`Synced: ${d.scoresUpdated} driver scores updated, ${d.alertsCreated} new alerts from ${d.recentEvents} recent events`);
      refreshSamsara();
    } else {
      setSyncResult(`Error: ${res.error}`);
    }
  };

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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Safety</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Driver safety events — live from Samsara + system alerts.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Sync from Samsara
        </button>
      </div>

      {syncResult && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${syncResult.startsWith("Error") ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {syncResult}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button onClick={() => setTab("samsara")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "samsara" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          Samsara Events ({samsaraData?.total ?? 0})
        </button>
        <button onClick={() => setTab("alerts")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "alerts" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          System Alerts ({alerts.length})
        </button>
      </div>

      {tab === "samsara" ? (
        /* ─── Samsara Events Tab ─── */
        <div>
          {/* Samsara KPIs */}
          {samsaraData && (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <p className="text-xs font-medium text-slate-400 uppercase">Total Events</p>
                <p className="mt-1 text-2xl font-bold">{samsaraData.total}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-center gap-2"><Gauge size={14} className="text-amber-500" /><p className="text-xs font-medium text-slate-400 uppercase">Speeding</p></div>
                <p className="mt-1 text-2xl font-bold text-amber-600">{samsaraData.events.filter((e) => e.behaviorLabel?.toLowerCase().includes("speed")).length}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-center gap-2"><Zap size={14} className="text-orange-500" /><p className="text-xs font-medium text-slate-400 uppercase">Harsh Events</p></div>
                <p className="mt-1 text-2xl font-bold text-orange-600">{samsaraData.events.filter((e) => { const l = e.behaviorLabel?.toLowerCase() ?? ""; return l.includes("harsh") || l.includes("accel") || l.includes("brak"); }).length}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-center gap-2"><TrendingDown size={14} className="text-red-500" /><p className="text-xs font-medium text-slate-400 uppercase">Crashes</p></div>
                <p className="mt-1 text-2xl font-bold text-red-600">{samsaraData.events.filter((e) => { const l = e.behaviorLabel?.toLowerCase() ?? ""; return l.includes("crash") || l.includes("collision"); }).length}</p>
              </div>
            </div>
          )}

          {/* Period filter */}
          <div className="mb-4 flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            <select value={days} onChange={(e) => setDays(e.target.value)} className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm">
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
            <button onClick={() => refreshSamsara()} className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm hover:bg-slate-50 flex items-center gap-1.5">
              <RefreshCw size={14} /> Refresh
            </button>
            <span className="ml-auto text-sm text-slate-500">{samsaraData?.total ?? 0} events</span>
          </div>

          <Card>
            <div className="divide-y divide-[var(--color-border)]">
              {samsaraLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
              ) : !samsaraData?.events?.length ? (
                <EmptyState icon={<ShieldAlert size={32} />} title="No Samsara events" description={`No safety events in the last ${days} days. Click Sync to pull fresh data.`} />
              ) : (
                samsaraData.events.map((evt) => {
                  const label = evt.behaviorLabel?.toLowerCase() ?? "";
                  const isSpeed = label.includes("speed");
                  const isCrash = label.includes("crash") || label.includes("collision");
                  const Icon = isSpeed ? Gauge : isCrash ? AlertOctagon : Zap;
                  const iconColor = isCrash ? "text-red-600 bg-red-50" : isSpeed ? "text-amber-600 bg-amber-50" : "text-orange-600 bg-orange-50";
                  return (
                    <div key={evt.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColor}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{evt.behaviorLabel}</p>
                        <p className="text-xs text-slate-400">
                          {evt.vehicleName && `${evt.vehicleName} · `}
                          {evt.driverName && `${evt.driverName} · `}
                          {formatDate(evt.time)}
                          {evt.maxG ? ` · ${evt.maxG.toFixed(2)}G` : ""}
                        </p>
                      </div>
                      <Badge bg={isCrash ? "bg-red-50" : isSpeed ? "bg-amber-50" : "bg-orange-50"} fg={isCrash ? "text-red-700" : isSpeed ? "text-amber-700" : "text-orange-700"}>
                        {isCrash ? "Critical" : isSpeed ? "Warning" : "Info"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      ) : (
        /* ─── System Alerts Tab ─── */
        <div>
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
      )}
    </div>
  );
}
