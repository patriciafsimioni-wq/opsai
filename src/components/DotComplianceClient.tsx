"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, Truck } from "lucide-react";
import { Card, Table, Th, Td, Badge, EmptyState, Avatar } from "@/components/ui";
import { useData } from "@/lib/use-data";
import type { DriverDTO } from "@/lib/types";
import { formatDate, daysUntil } from "@/lib/utils";

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  BOX_TRUCK: "Box Truck",
  TRACTOR_TRUCK: "Tractor Truck",
};

type DateStatus = "valid" | "expiring" | "expired" | "missing";

function dateStatus(value?: string | null): DateStatus {
  if (!value) return "missing";
  const d = daysUntil(value);
  if (d == null) return "missing";
  if (d < 0) return "expired";
  if (d <= 30) return "expiring";
  return "valid";
}

function StatusCell({ value }: { value?: string | null }) {
  const s = dateStatus(value);
  const map: Record<DateStatus, { bg: string; fg: string; label: string }> = {
    valid: { bg: "#dcfce7", fg: "#166534", label: formatDate(value!) },
    expiring: { bg: "#fef9c3", fg: "#854d0e", label: `${formatDate(value!)} (${daysUntil(value!)}d)` },
    expired: { bg: "#fee2e2", fg: "#991b1b", label: `${formatDate(value!)} (Expired)` },
    missing: { bg: "#f1f5f9", fg: "#64748b", label: "Not set" },
  };
  const c = map[s];
  return <Badge bg={c.bg} fg={c.fg}>{c.label}</Badge>;
}

const DRUG_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  PASS: { bg: "#dcfce7", fg: "#166534", label: "Pass" },
  PENDING: { bg: "#fef9c3", fg: "#854d0e", label: "Pending" },
  FAIL: { bg: "#fee2e2", fg: "#991b1b", label: "Fail" },
};

export function DotComplianceClient() {
  const { data: drivers, loading } = useData<DriverDTO[]>("/api/drivers");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | "expiring" | "missing">("all");

  const dotDrivers = useMemo(
    () => (drivers ?? []).filter((d) => d.vehicleType === "BOX_TRUCK" || d.vehicleType === "TRACTOR_TRUCK"),
    [drivers],
  );

  const counts = useMemo(() => {
    let expired = 0, expiring = 0, missing = 0;
    for (const d of dotDrivers) {
      const statuses = [dateStatus(d.medicalCardExpiry), dateStatus(d.licenseExpiry), dateStatus(d.annualReviewAt)];
      if (statuses.includes("expired")) expired++;
      else if (statuses.includes("expiring")) expiring++;
      else if (statuses.includes("missing") || !d.drugTestStatus) missing++;
    }
    return { expired, expiring, missing, total: dotDrivers.length };
  }, [dotDrivers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dotDrivers.filter((d) => {
      if (q && !`${d.firstName} ${d.lastName}`.toLowerCase().includes(q) && !d.email.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && d.vehicleType !== typeFilter) return false;
      if (statusFilter !== "all") {
        const statuses = [dateStatus(d.medicalCardExpiry), dateStatus(d.licenseExpiry), dateStatus(d.annualReviewAt)];
        if (statusFilter === "expired" && !statuses.includes("expired")) return false;
        if (statusFilter === "expiring" && !statuses.includes("expiring")) return false;
        if (statusFilter === "missing" && !statuses.includes("missing") && !!d.drugTestStatus) return false;
      }
      return true;
    });
  }, [dotDrivers, search, typeFilter, statusFilter]);

  const tiles: { key: typeof statusFilter; label: string; value: number; bg: string; fg: string }[] = [
    { key: "expired", label: "Expired", value: counts.expired, bg: "#fee2e2", fg: "#991b1b" },
    { key: "expiring", label: "Expiring ≤30d", value: counts.expiring, bg: "#fef9c3", fg: "#854d0e" },
    { key: "missing", label: "Missing info", value: counts.missing, bg: "#f1f5f9", fg: "#475569" },
    { key: "all", label: "DOT Drivers", value: counts.total, bg: "#dbeafe", fg: "#1e40af" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={() => setStatusFilter(t.key)}
            className={`rounded-xl border p-4 text-left transition ${statusFilter === t.key ? "ring-2 ring-blue-500" : "border-slate-200"}`}
            style={{ background: t.bg }}
          >
            <p className="text-xs font-medium" style={{ color: t.fg }}>{t.label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: t.fg }}>{t.value}</p>
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
              placeholder="Search drivers…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Vehicle Types</option>
            <option value="BOX_TRUCK">Box Truck</option>
            <option value="TRACTOR_TRUCK">Tractor Truck</option>
          </select>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={40} />} title="No DOT drivers found" description="Set a driver's Vehicle Type to Box Truck or Tractor Truck to track DOT compliance." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Driver</Th>
                <Th>Station</Th>
                <Th>Vehicle Type</Th>
                <Th>Medical Card</Th>
                <Th>CDL / License</Th>
                <Th>MVR Checked</Th>
                <Th>Drug & Alcohol</Th>
                <Th>Annual Review</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/drivers/${d.id}`} className="flex items-center gap-3">
                      <Avatar name={`${d.firstName} ${d.lastName}`} color={d.avatarColor} size={32} />
                      <div>
                        <p className="font-medium text-blue-700 hover:underline">{d.firstName} {d.lastName}</p>
                        <p className="text-xs text-slate-400">{d.email}</p>
                      </div>
                    </Link>
                  </Td>
                  <Td className="text-xs font-medium text-slate-600">{d.station || "—"}</Td>
                  <Td className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Truck size={13} /> {VEHICLE_TYPE_LABEL[d.vehicleType ?? ""] ?? "—"}</span>
                  </Td>
                  <Td><StatusCell value={d.medicalCardExpiry} /></Td>
                  <Td>
                    <StatusCell value={d.licenseExpiry} />
                    {d.licenseClass && <span className="ml-1 text-xs text-slate-400">Cl. {d.licenseClass}</span>}
                  </Td>
                  <Td>{d.mvrCheckedAt ? <span className="text-sm text-slate-600">{formatDate(d.mvrCheckedAt)}</span> : <Badge bg="#f1f5f9" fg="#64748b">Not set</Badge>}</Td>
                  <Td>
                    {d.drugTestStatus ? (
                      <Badge bg={DRUG_STATUS[d.drugTestStatus].bg} fg={DRUG_STATUS[d.drugTestStatus].fg}>{DRUG_STATUS[d.drugTestStatus].label}</Badge>
                    ) : (
                      <Badge bg="#f1f5f9" fg="#64748b">Not set</Badge>
                    )}
                  </Td>
                  <Td><StatusCell value={d.annualReviewAt} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
