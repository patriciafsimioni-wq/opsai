"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, StatCard, Table, Th, Td, EmptyState, Badge } from "@/components/ui";
import { MultiLineChart, BarChartCard } from "@/components/charts";
import { ExportButton } from "@/components/ReportsExport";
import { useData } from "@/lib/use-data";
import type { WorkOrderDTO } from "@/lib/types";
import { STATIONS, STATION_LABEL, SERVICE_CATEGORY, SERVICE_CATEGORIES, PREVENTIVE_GROUPS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function ServiceCostsClient() {
  const { data: orders, loading } = useData<WorkOrderDTO[]>("/api/maintenance");
  const [monthFilter, setMonthFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Only completed work orders with a completion date count toward spend.
  const completed = useMemo(
    () => (orders ?? []).filter((o) => o.status === "COMPLETED" && o.completedAt),
    [orders],
  );

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of completed) set.add(monthKey(new Date(o.completedAt!)));
    return Array.from(set).sort().reverse();
  }, [completed]);

  const filtered = useMemo(() => {
    return completed.filter((o) => {
      const mk = monthKey(new Date(o.completedAt!));
      const cat = o.service?.category ?? "CORRECTIVE";
      return (
        (!monthFilter || mk === monthFilter) &&
        (!stationFilter || o.station === stationFilter) &&
        (!categoryFilter || cat === categoryFilter)
      );
    });
  }, [completed, monthFilter, stationFilter, categoryFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, o) => {
        acc.material += o.materialCost;
        acc.labor += o.laborCost;
        acc.total += o.cost;
        acc.count += 1;
        if ((o.service?.category ?? "CORRECTIVE") === "PREVENTIVE") acc.preventive += o.cost;
        else acc.corrective += o.cost;
        return acc;
      },
      { material: 0, labor: 0, total: 0, count: 0, preventive: 0, corrective: 0 },
    );
  }, [filtered]);

  // Per service
  const byService = useMemo(() => {
    const map = new Map<string, { name: string; category: string; count: number; material: number; labor: number; total: number }>();
    for (const o of filtered) {
      const name = o.service?.name ?? o.title;
      const category = o.service?.category ?? "CORRECTIVE";
      const key = `${category}:${name}`;
      const cur = map.get(key) ?? { name, category, count: 0, material: 0, labor: 0, total: 0 };
      cur.count += 1;
      cur.material += o.materialCost;
      cur.labor += o.laborCost;
      cur.total += o.cost;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Per station
  const byStation = useMemo(() => {
    return STATIONS.map((st) => {
      const rows = filtered.filter((o) => o.station === st);
      return {
        station: st,
        count: rows.length,
        material: rows.reduce((s, o) => s + o.materialCost, 0),
        labor: rows.reduce((s, o) => s + o.laborCost, 0),
        total: rows.reduce((s, o) => s + o.cost, 0),
      };
    }).filter((r) => r.count > 0).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Per month trend (preventive vs corrective), respects station/category filters but not month filter
  const trend = useMemo(() => {
    const base = completed.filter(
      (o) =>
        (!stationFilter || o.station === stationFilter) &&
        (!categoryFilter || (o.service?.category ?? "CORRECTIVE") === categoryFilter),
    );
    const map = new Map<string, { Preventive: number; Corrective: number }>();
    for (const o of base) {
      const mk = monthKey(new Date(o.completedAt!));
      const cur = map.get(mk) ?? { Preventive: 0, Corrective: 0 };
      if ((o.service?.category ?? "CORRECTIVE") === "PREVENTIVE") cur.Preventive += o.cost;
      else cur.Corrective += o.cost;
      map.set(mk, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, v]) => ({ label: monthLabel(key), Preventive: Math.round(v.Preventive), Corrective: Math.round(v.Corrective) }));
  }, [completed, stationFilter, categoryFilter]);

  const stationChart = useMemo(
    () => byStation.map((r) => ({ label: r.station, value: Math.round(r.total) })),
    [byStation],
  );

  // Preventive matrix: rows = preventive services, columns = stations, for the selected month.
  const prevOrders = useMemo(
    () =>
      completed.filter(
        (o) =>
          (o.service?.category ?? "CORRECTIVE") === "PREVENTIVE" &&
          (!monthFilter || monthKey(new Date(o.completedAt!)) === monthFilter),
      ),
    [completed, monthFilter],
  );

  const prevMatrix = useMemo(() => {
    const zero = () => Object.fromEntries(STATIONS.map((s) => [s, 0])) as Record<string, number>;
    const labelFor = new Map<string, string>();
    for (const g of PREVENTIVE_GROUPS) for (const s of g.services) labelFor.set(s, g.label);
    const map = new Map<string, { name: string; perStation: Record<string, number>; total: number }>();
    // Seed the headline buckets in display order so they always appear.
    for (const g of PREVENTIVE_GROUPS) map.set(g.label, { name: g.label, perStation: zero(), total: 0 });
    for (const o of prevOrders) {
      const svcName = o.service?.name ?? o.title;
      const label = labelFor.get(svcName) ?? svcName;
      const cur = map.get(label) ?? { name: label, perStation: zero(), total: 0 };
      cur.perStation[o.station] += o.cost;
      cur.total += o.cost;
      map.set(label, cur);
    }
    return Array.from(map.values());
  }, [prevOrders]);

  const prevStationTotals = useMemo(() => {
    const totals = Object.fromEntries(STATIONS.map((s) => [s, 0])) as Record<string, number>;
    for (const o of prevOrders) totals[o.station] += o.cost;
    return totals;
  }, [prevOrders]);

  const prevGrand = useMemo(() => prevOrders.reduce((s, o) => s + o.cost, 0), [prevOrders]);

  const prevMatrixCsv = useMemo(
    () =>
      prevMatrix.map((r) => ({
        Service: r.name,
        ...Object.fromEntries(STATIONS.map((s) => [s, Math.round(r.perStation[s])])),
        Total: Math.round(r.total),
      })),
    [prevMatrix],
  );

  // CSV: one row per service × station × month
  const csvRows = useMemo(() => {
    const map = new Map<string, { Month: string; Station: string; Service: string; Category: string; Count: number; Material: number; Labor: number; Total: number }>();
    for (const o of filtered) {
      const mk = monthLabel(monthKey(new Date(o.completedAt!)));
      const name = o.service?.name ?? o.title;
      const category = SERVICE_CATEGORY[(o.service?.category ?? "CORRECTIVE") as keyof typeof SERVICE_CATEGORY].label;
      const key = `${mk}|${o.station}|${category}|${name}`;
      const cur = map.get(key) ?? { Month: mk, Station: o.station, Service: name, Category: category, Count: 0, Material: 0, Labor: 0, Total: 0 };
      cur.Count += 1;
      cur.Material += o.materialCost;
      cur.Labor += o.laborCost;
      cur.Total += o.cost;
      map.set(key, cur);
    }
    return Array.from(map.values()).map((r) => ({
      ...r,
      Material: Math.round(r.Material),
      Labor: Math.round(r.Labor),
      Total: Math.round(r.Total),
    }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">All months</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">All stations</option>
            {STATIONS.map((s) => (
              <option key={s} value={s}>{STATION_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">All categories</option>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{SERVICE_CATEGORY[c].label}</option>
            ))}
          </select>
          <div className="ml-auto">
            <ExportButton rows={csvRows} filename="service-costs.csv" label="Export CSV" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Cost" value={formatCurrency(totals.total)} accent="#2563eb" hint={`${totals.count} services`} />
        <StatCard label="Material" value={formatCurrency(totals.material)} accent="#0891b2" />
        <StatCard label="Labor" value={formatCurrency(totals.labor)} accent="#d97706" />
        <StatCard
          label="Preventive / Corrective"
          value={`${formatCurrency(totals.preventive)} / ${formatCurrency(totals.corrective)}`}
          accent="#16a34a"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly Cost Trend" subtitle="Preventive vs corrective · last 6 months" />
          <div className="p-4">
            {trend.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No data</p>
            ) : (
              <MultiLineChart
                data={trend}
                lines={[
                  { key: "Preventive", color: "#16a34a", name: "Preventive" },
                  { key: "Corrective", color: "#dc2626", name: "Corrective" },
                ]}
              />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Cost by Station" />
          <div className="p-4">
            {stationChart.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No data</p>
            ) : (
              <BarChartCard data={stationChart} color="#7c3aed" />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] p-4">
          <div>
            <h3 className="text-sm font-semibold">Preventive Maintenance — Cost per Station</h3>
            <p className="text-xs text-slate-400">
              {monthFilter ? monthLabel(monthFilter) : "All months"} · cost per station for each preventive service group
            </p>
          </div>
          <ExportButton rows={prevMatrixCsv} filename="preventive-cost-by-station.csv" label="Export matrix" />
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : prevMatrix.length === 0 ? (
          <EmptyState title="No preventive services for this selection" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Service</Th>
                  {STATIONS.map((s) => (
                    <Th key={s}>{s}</Th>
                  ))}
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {prevMatrix.map((r) => (
                  <tr key={r.name} className="hover:bg-slate-50">
                    <Td className="font-medium whitespace-nowrap">{r.name}</Td>
                    {STATIONS.map((s) => (
                      <Td key={s} className="text-slate-600">
                        {r.perStation[s] ? formatCurrency(r.perStation[s]) : "—"}
                      </Td>
                    ))}
                    <Td className="font-semibold">{formatCurrency(r.total)}</Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--color-border)] bg-slate-50 font-semibold">
                  <Td>Total</Td>
                  {STATIONS.map((s) => (
                    <Td key={s}>{prevStationTotals[s] ? formatCurrency(prevStationTotals[s]) : "—"}</Td>
                  ))}
                  <Td>{formatCurrency(prevGrand)}</Td>
                </tr>
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Cost by Station" subtitle="Material + labor per station" />
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : byStation.length === 0 ? (
          <EmptyState title="No service costs for this selection" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Station</Th>
                <Th>Services</Th>
                <Th>Material</Th>
                <Th>Labor</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {byStation.map((r) => (
                <tr key={r.station} className="hover:bg-slate-50">
                  <Td><Badge bg="#eef2ff" fg="#3730a3">{r.station}</Badge> <span className="ml-1 text-xs text-slate-400">{STATION_LABEL[r.station].split(" — ")[1]}</span></Td>
                  <Td className="text-slate-600">{r.count}</Td>
                  <Td className="text-slate-600">{formatCurrency(r.material)}</Td>
                  <Td className="text-slate-600">{formatCurrency(r.labor)}</Td>
                  <Td className="font-semibold">{formatCurrency(r.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Cost by Service" subtitle="Aggregated for the current selection" />
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : byService.length === 0 ? (
          <EmptyState title="No service costs for this selection" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Category</Th>
                <Th>Count</Th>
                <Th>Material</Th>
                <Th>Labor</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {byService.map((r) => (
                <tr key={`${r.category}:${r.name}`} className="hover:bg-slate-50">
                  <Td className="font-medium">{r.name}</Td>
                  <Td>
                    <Badge
                      bg={SERVICE_CATEGORY[r.category as keyof typeof SERVICE_CATEGORY].bg}
                      fg={SERVICE_CATEGORY[r.category as keyof typeof SERVICE_CATEGORY].fg}
                    >
                      {SERVICE_CATEGORY[r.category as keyof typeof SERVICE_CATEGORY].label}
                    </Badge>
                  </Td>
                  <Td className="text-slate-600">{r.count}</Td>
                  <Td className="text-slate-600">{formatCurrency(r.material)}</Td>
                  <Td className="text-slate-600">{formatCurrency(r.labor)}</Td>
                  <Td className="font-semibold">{formatCurrency(r.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
