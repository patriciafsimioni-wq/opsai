"use client";

import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { Card, Table, Th, Td, SortTh } from "@/components/ui";
import { useTableSort } from "@/lib/use-sort";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { STATIONS } from "@/lib/constants";

const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  created: { bg: "#dcfce7", fg: "#166534" },
  logged: { bg: "#dcfce7", fg: "#166534" },
  requested: { bg: "#dbeafe", fg: "#1e40af" },
  updated: { bg: "#fef9c3", fg: "#854d0e" },
  approved: { bg: "#dcfce7", fg: "#166534" },
  rejected: { bg: "#fee2e2", fg: "#991b1b" },
  flagged: { bg: "#ffedd5", fg: "#9a3412" },
  deleted: { bg: "#fee2e2", fg: "#991b1b" },
};

type ActivityRow = {
  id: string;
  createdAt: string | Date;
  userId: string | null;
  userName: string;
  action: string;
  entity: string;
  entityLabel: string;
  station: string | null;
  detail: string | null;
};

export function ActivityClient({
  rows,
  showStationFilter,
}: {
  rows: ActivityRow[];
  showStationFilter: boolean;
}) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");

  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  );
  const entities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity))).sort(),
    [rows],
  );

  const sort = useTableSort<ActivityRow, "when" | "user" | "action" | "entity" | "label" | "station" | "detail">(
    {
      when: (r) => new Date(r.createdAt).getTime(),
      user: (r) => r.userName.toLowerCase(),
      action: (r) => r.action,
      entity: (r) => r.entity,
      label: (r) => r.entityLabel.toLowerCase(),
      station: (r) => (r.station ?? "").toLowerCase(),
      detail: (r) => (r.detail ?? "").toLowerCase(),
    },
    "when",
    "desc",
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = rows.filter((r) => {
      if (
        q &&
        !r.userName.toLowerCase().includes(q) &&
        !r.entity.toLowerCase().includes(q) &&
        !r.entityLabel.toLowerCase().includes(q) &&
        !(r.detail ?? "").toLowerCase().includes(q)
      )
        return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (entityFilter !== "all" && r.entity !== entityFilter) return false;
      if (stationFilter !== "all" && r.station !== stationFilter) return false;
      return true;
    });
    return sort.sortRows(result);
  }, [rows, search, actionFilter, entityFilter, stationFilter, sort]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <History size={22} className="text-blue-600" /> Activity Log
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Every change made across the portal — who changed what, and when.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, item, or detail…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm capitalize outline-none focus:border-blue-500"
          >
            <option value="all">All actions</option>
            {actions.map((a) => <option key={a} value={a} className="capitalize">{a}</option>)}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All types</option>
            {entities.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          {showStationFilter && (
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All stations</option>
              {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <span className="text-xs text-slate-400">{filtered.length} of {rows.length}</span>
        </div>
        <Table>
          <thead>
            <tr>
              <SortTh label="When" col="when" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="User" col="user" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Action" col="action" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Type" col="entity" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Item" col="label" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Detail" col="detail" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <Td className="text-center text-slate-400" >
                  <span className="block py-6">No activity matches your filters.</span>
                </Td>
              </tr>
            ) : (
              filtered.map((r) => {
                const style = ACTION_STYLE[r.action] ?? { bg: "#e2e8f0", fg: "#475569" };
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap text-slate-600" >
                      <span title={formatDateTime(r.createdAt)}>{relativeTime(r.createdAt)}</span>
                    </Td>
                    <Td className="font-medium">{r.userName}</Td>
                    <Td>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
                        style={{ backgroundColor: style.bg, color: style.fg }}
                      >
                        {r.action}
                      </span>
                    </Td>
                    <Td className="text-slate-600">{r.entity}</Td>
                    <Td className="text-slate-700">{r.entityLabel}</Td>
                    <Td className="text-slate-600">{r.station ?? "—"}</Td>
                    <Td className="text-slate-500">{r.detail ?? "—"}</Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
