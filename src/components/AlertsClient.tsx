"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Check,
  Trash2,
  CheckCheck,
  Gauge,
  MapPin,
  Wrench,
  FileWarning,
  Fuel,
  Clock,
  AlertOctagon,
} from "lucide-react";
import { Card, Button, Badge, EmptyState } from "@/components/ui";
import { useData, apiSend } from "@/lib/use-data";
import type { AlertDTO } from "@/lib/types";
import { ALERT_SEVERITY, ALERT_TYPE_LABEL } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  SPEEDING: Gauge,
  GEOFENCE_ENTER: MapPin,
  GEOFENCE_EXIT: MapPin,
  MAINTENANCE_DUE: Wrench,
  DOCUMENT_EXPIRY: FileWarning,
  LOW_FUEL: Fuel,
  IDLE: Clock,
  HARSH_DRIVING: AlertOctagon,
};

export function AlertsClient() {
  const router = useRouter();
  const { data: alerts, loading, reload } = useData<AlertDTO[]>("/api/alerts");
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"all" | "unread">("all");

  const filtered = useMemo(() => {
    if (!alerts) return [];
    const safetyTypes = ["SPEEDING", "HARSH_DRIVING"];
    return alerts.filter((a) => {
      if (safetyTypes.includes(a.type)) return false;
      if (tab === "unread" && a.read) return false;
      if (filter && a.severity !== filter) return false;
      return true;
    });
  }, [alerts, filter, tab]);

  async function markRead(a: AlertDTO) {
    await apiSend(`/api/alerts/${a.id}`, "PATCH", { read: true });
    reload();
    router.refresh();
  }
  async function markAllRead() {
    await apiSend("/api/alerts", "PATCH");
    reload();
    router.refresh();
  }
  async function remove(a: AlertDTO) {
    await apiSend(`/api/alerts/${a.id}`, "DELETE");
    reload();
    router.refresh();
  }

  const unreadCount = (alerts ?? []).filter((a) => !a.read).length;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize " +
                (tab === t ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")
              }
            >
              {t}
              {t === "unread" && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          ))}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <div className="ml-auto">
          <Button variant="secondary" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck size={16} /> Mark all read
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Bell size={40} />} title="No alerts" description="You're all caught up." />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {filtered.map((a) => {
            const sev = ALERT_SEVERITY[a.severity as keyof typeof ALERT_SEVERITY];
            const Icon = ICONS[a.type] ?? Bell;
            const href = a.vehicleId
              ? `/vehicles/${a.vehicleId}`
              : a.driverId
                ? `/drivers/${a.driverId}`
                : null;
            return (
              <div
                key={a.id}
                className={"flex items-center gap-4 px-5 py-3.5 " + (a.read ? "" : "bg-blue-50/40")}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: sev.bg, color: sev.color }}
                >
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link href={href} className="group">
                      <p className="text-sm font-medium group-hover:text-blue-600 group-hover:underline">{a.message}</p>
                      <p className="text-xs text-slate-400">
                        {ALERT_TYPE_LABEL[a.type]} · {relativeTime(a.createdAt)}
                        {a.vehicle ? ` · ${a.vehicle.name}` : ""}
                      </p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{a.message}</p>
                      <p className="text-xs text-slate-400">
                        {ALERT_TYPE_LABEL[a.type]} · {relativeTime(a.createdAt)}
                        {a.vehicle ? ` · ${a.vehicle.name}` : ""}
                      </p>
                    </>
                  )}
                </div>
                <Badge bg={sev.bg} fg={sev.fg}>
                  {sev.label}
                </Badge>
                <div className="flex gap-1">
                  {!a.read && (
                    <button
                      onClick={() => markRead(a)}
                      title="Mark as read"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => remove(a)}
                    title="Delete"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
