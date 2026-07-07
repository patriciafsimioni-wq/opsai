"use client";

import { useState, useEffect, useRef } from "react";
import { PM_CATEGORIES, STATION_LABEL, STATIONS } from "@/lib/constants";
import { useData } from "@/lib/use-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUDGET_STATIONS = STATIONS;

type BudgetRecord = {
  id: string;
  year: number;
  month: number;
  station: string;
  category: string;
  amount: number;
};

type BudgetMap = Record<string, Record<string, number[]>>;

function buildMap(records: BudgetRecord[]): BudgetMap {
  const map: BudgetMap = {};
  for (const station of BUDGET_STATIONS) {
    map[station] = {};
    for (const cat of PM_CATEGORIES) {
      map[station][cat] = Array(12).fill(0);
    }
  }
  for (const r of records) {
    if (map[r.station]?.[r.category]) {
      map[r.station][r.category][r.month - 1] = r.amount;
    }
  }
  return map;
}

export function BudgetEditorClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [station, setStation] = useState<string>("IAH");
  const { data: rawBudgets, loading } = useData<BudgetRecord[]>(`/api/pm-budgets?year=${year}`);
  const [budgets, setBudgets] = useState<BudgetMap>({});
  const [original, setOriginal] = useState<BudgetMap>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const prevRaw = useRef(rawBudgets);

  useEffect(() => {
    if (rawBudgets && rawBudgets !== prevRaw.current) {
      prevRaw.current = rawBudgets;
      const map = buildMap(rawBudgets);
      setBudgets(map);
      setOriginal(JSON.parse(JSON.stringify(map)));
    }
  }, [rawBudgets]);

  const handleChange = (cat: string, monthIdx: number, value: string) => {
    const num = parseFloat(value) || 0;
    setBudgets((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as BudgetMap;
      if (next[station]?.[cat]) {
        next[station][cat][monthIdx] = Math.round(num);
      }
      return next;
    });
  };

  const getChanges = () => {
    const changes: { year: number; month: number; station: string; category: string; amount: number }[] = [];
    for (const st of BUDGET_STATIONS) {
      for (const cat of PM_CATEGORIES) {
        for (let m = 0; m < 12; m++) {
          const curr = budgets[st]?.[cat]?.[m] ?? 0;
          const orig = original[st]?.[cat]?.[m] ?? 0;
          if (curr !== orig) {
            changes.push({ year, month: m + 1, station: st, category: cat, amount: curr });
          }
        }
      }
    }
    return changes;
  };

  const handleSave = async () => {
    const changes = getChanges();
    if (changes.length === 0) {
      setMessage("No changes to save.");
      return;
    }
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/pm-budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgets: changes }),
    });
    if (res.ok) {
      const result = await res.json();
      setMessage(`Saved ${result.updated} budget entries.`);
      setOriginal(JSON.parse(JSON.stringify(budgets)));
    } else {
      setMessage("Failed to save. Check permissions.");
    }
    setSaving(false);
  };

  const handleCopyToAll = (cat: string) => {
    const janVal = budgets[station]?.[cat]?.[0] ?? 0;
    setBudgets((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as BudgetMap;
      if (next[station]?.[cat]) {
        for (let m = 0; m < 12; m++) {
          next[station][cat][m] = janVal;
        }
      }
      return next;
    });
  };

  const changeCount = getChanges().length;
  const stationData = budgets[station] ?? {};

  if (loading) return <div className="p-8 text-center text-slate-500">Loading budgets...</div>;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Station</label>
          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            {BUDGET_STATIONS.map((s) => (
              <option key={s} value={s}>{STATION_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {message && (
            <span className={`text-sm ${message.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </span>
          )}
          {changeCount > 0 && (
            <span className="text-xs text-slate-500">{changeCount} unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || changeCount === 0}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Budget table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="sticky left-0 bg-slate-700 px-3 py-2 text-left text-sm font-bold" colSpan={2}>
                {STATION_LABEL[station] ?? station} — {year} Budget
              </th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-2 text-center font-semibold">{m}</th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Annual Total</th>
            </tr>
          </thead>
          <tbody>
            {PM_CATEGORIES.map((cat, i) => {
              const vals = stationData[cat] ?? Array(12).fill(0);
              const annual = vals.reduce((s: number, v: number) => s + v, 0);
              return (
                <tr key={cat} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="sticky left-0 bg-inherit px-2 py-1.5 text-slate-400">{i + 1}</td>
                  <td className="sticky left-6 bg-inherit whitespace-nowrap px-2 py-1.5 font-medium">
                    <div className="flex items-center gap-1">
                      <span>{cat}</span>
                      <button
                        onClick={() => handleCopyToAll(cat)}
                        title="Copy Jan value to all months"
                        className="ml-1 rounded px-1 text-[10px] text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      >
                        fill
                      </button>
                    </div>
                  </td>
                  {vals.map((v: number, m: number) => {
                    const orig = original[station]?.[cat]?.[m] ?? 0;
                    const changed = v !== orig;
                    return (
                      <td key={m} className="px-1 py-0.5">
                        <input
                          type="number"
                          value={v || ""}
                          onChange={(e) => handleChange(cat, m, e.target.value)}
                          className={`w-full rounded border px-1.5 py-1 text-right tabular-nums text-xs ${
                            changed
                              ? "border-blue-400 bg-blue-50"
                              : "border-transparent bg-transparent hover:border-slate-200"
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                    ${annual.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
              <td className="sticky left-0 bg-slate-100 px-2 py-2"></td>
              <td className="sticky left-6 bg-slate-100 px-2 py-2">TOTAL</td>
              {MONTHS.map((_, m) => {
                const colTotal = PM_CATEGORIES.reduce((s, cat) => s + (stationData[cat]?.[m] ?? 0), 0);
                return (
                  <td key={m} className="px-2 py-2 text-right tabular-nums">
                    ${colTotal.toLocaleString()}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right tabular-nums">
                ${PM_CATEGORIES.reduce((s, cat) => {
                  const vals = stationData[cat] ?? [];
                  return s + vals.reduce((a: number, b: number) => a + b, 0);
                }, 0).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Click any cell to edit. Use &quot;fill&quot; to copy January&apos;s value to all months. Save to persist changes.
      </p>
    </div>
  );
}
