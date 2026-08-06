"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldX, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Card, Table, Th, Td, EmptyState } from "@/components/ui";
import { STATION_LABEL } from "@/lib/constants";
import { daysUntil, cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  dxNumber: string | null;
  licensePlate: string | null;
  station: string | null;
  type: string;
  registrationExpiry: string | null;
  insuranceExpiry: string | null;
  dotInspectionExpiry: string | null;
  dotInspectionDocUrl: string | null;
};

type DocState = "valid" | "expiring" | "expired" | "missing";

function docState(iso: string | null): { state: DocState; days: number | null } {
  if (!iso) return { state: "missing", days: null };
  const days = daysUntil(iso);
  if (days == null) return { state: "missing", days: null };
  if (days < 0) return { state: "expired", days };
  if (days <= 30) return { state: "expiring", days };
  return { state: "valid", days };
}

function DocBadge({ iso }: { iso: string | null }) {
  const { state, days } = docState(iso);
  const dateStr = iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const cfg = {
    valid: { bg: "bg-green-100", fg: "text-green-700", label: `${days}d left` },
    expiring: { bg: "bg-amber-100", fg: "text-amber-800", label: `${days}d left` },
    expired: { bg: "bg-red-100", fg: "text-red-700", label: days != null ? `${Math.abs(days)}d ago` : "expired" },
    missing: { bg: "bg-slate-100", fg: "text-slate-500", label: "not set" },
  }[state];
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-slate-700">{dateStr}</span>
      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.fg}`}>
        {cfg.label}
      </span>
    </div>
  );
}

// Worst of the applicable documents drives the row's overall status.
// The DOT annual inspection only applies to trucks.
function rowState(v: Row): DocState {
  const order: DocState[] = ["expired", "expiring", "missing", "valid"];
  const states = [docState(v.registrationExpiry).state, docState(v.insuranceExpiry).state];
  if (v.type === "TRUCK") states.push(docState(v.dotInspectionExpiry).state);
  return order.find((s) => states.includes(s)) ?? "valid";
}

const STATIONS_IN_DATA = (rows: Row[]) =>
  [...new Set(rows.map((r) => r.station).filter(Boolean))].sort() as string[];

type SortKey = "name" | "station" | "registration" | "insurance" | "dotInspection";

// null expiries sort last in ascending order.
function sortValue(v: Row, key: SortKey): string | number {
  switch (key) {
    case "name": return (v.dxNumber || v.name).toLowerCase();
    case "station": return (v.station ?? "").toLowerCase();
    case "registration": return v.registrationExpiry ? new Date(v.registrationExpiry).getTime() : Number.POSITIVE_INFINITY;
    case "insurance": return v.insuranceExpiry ? new Date(v.insuranceExpiry).getTime() : Number.POSITIVE_INFINITY;
    case "dotInspection": return v.dotInspectionExpiry ? new Date(v.dotInspectionExpiry).getTime() : Number.POSITIVE_INFINITY;
  }
}

export function ComplianceAuditClient({ vehicles }: { vehicles: Row[] }) {
  const [search, setSearch] = useState("");
  const [station, setStation] = useState("");
  const [filter, setFilter] = useState<"" | DocState>("");
  const [sortKey, setSortKey] = useState<SortKey>("registration");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const counts = useMemo(() => {
    const c = { expired: 0, expiring: 0, missing: 0, valid: 0 };
    for (const v of vehicles) c[rowState(v)]++;
    return c;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vehicles
      .filter((v) => {
        const matchSearch =
          !q ||
          v.name.toLowerCase().includes(q) ||
          (v.dxNumber ?? "").toLowerCase().includes(q) ||
          (v.licensePlate ?? "").toLowerCase().includes(q);
        const matchStation = !station || v.station === station;
        const matchStatus = !filter || rowState(v) === filter;
        return matchSearch && matchStation && matchStatus;
      })
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [vehicles, search, station, filter, sortKey, sortDir]);

  const cards: { key: DocState; label: string; icon: typeof ShieldCheck; bg: string; fg: string; n: number }[] = [
    { key: "expired", label: "Expired", icon: ShieldX, bg: "bg-red-50", fg: "text-red-700", n: counts.expired },
    { key: "expiring", label: "Expiring ≤30d", icon: ShieldAlert, bg: "bg-amber-50", fg: "text-amber-800", n: counts.expiring },
    { key: "missing", label: "Not set", icon: ShieldAlert, bg: "bg-slate-50", fg: "text-slate-600", n: counts.missing },
    { key: "valid", label: "Valid", icon: ShieldCheck, bg: "bg-green-50", fg: "text-green-700", n: counts.valid },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter((f) => (f === c.key ? "" : c.key))}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${c.bg} ${
              filter === c.key ? "ring-2 ring-blue-500" : "border-transparent"
            }`}
          >
            <c.icon className={c.fg} size={22} />
            <div>
              <p className={`text-2xl font-bold ${c.fg}`}>{c.n}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle, DX, plate…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">All stations</option>
            {STATIONS_IN_DATA(vehicles).map((s) => (
              <option key={s} value={s}>
                {STATION_LABEL[s as keyof typeof STATION_LABEL]?.split(" - ")[0] ?? s}
              </option>
            ))}
          </select>
          {filter && (
            <button onClick={() => setFilter("")} className="text-xs text-blue-600 hover:underline">
              Clear status filter
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={40} />} title="No vehicles match" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th><SortHeader label="Vehicle" col="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><SortHeader label="Station" col="station" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><SortHeader label="Registration Expiry" col="registration" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><SortHeader label="Insurance Expiry" col="insurance" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
                <Th><SortHeader label="DOT Inspection" col="dotInspection" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/vehicles/${v.id}`} className="block">
                      <p className="font-medium text-blue-700 hover:underline">{v.name}</p>
                      <p className="text-xs text-slate-400">{v.licensePlate}</p>
                    </Link>
                  </Td>
                  <Td className="text-slate-600">
                    {STATION_LABEL[v.station as keyof typeof STATION_LABEL]?.split(" - ")[0] ?? v.station ?? "—"}
                  </Td>
                  <Td><DocBadge iso={v.registrationExpiry} /></Td>
                  <Td><DocBadge iso={v.insuranceExpiry} /></Td>
                  <Td>
                    {v.type === "TRUCK" ? (
                      <div className="flex items-center gap-2">
                        <DocBadge iso={v.dotInspectionExpiry} />
                        {v.dotInspectionDocUrl && (
                          <a href={v.dotInspectionDocUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline">View</a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">N/A</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (col: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <button
      onClick={() => onClick(col)}
      className={cn("inline-flex items-center gap-1 hover:text-slate-900", active ? "text-slate-900" : "text-slate-500")}
    >
      {label}
      {active ? (
        sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      ) : (
        <ChevronsUpDown size={13} className="text-slate-300" />
      )}
    </button>
  );
}
