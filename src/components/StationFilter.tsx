"use client";

import { useRouter, useSearchParams } from "next/navigation";

const STATIONS = ["All", "IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT"];

export function StationFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("station") || "All";

  function onChange(station: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (station === "All") {
      params.delete("station");
    } else {
      params.set("station", station);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
    >
      {STATIONS.map((s) => (
        <option key={s} value={s}>
          {s === "All" ? "All Stations" : s}
        </option>
      ))}
    </select>
  );
}
