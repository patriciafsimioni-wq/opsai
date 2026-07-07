"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { STATIONS as BRAND_STATIONS } from "@/lib/constants";

const STATIONS = ["", ...BRAND_STATIONS];

export function FleetFinanceStationFilter({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(station: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (station) {
      params.set("station", station);
    } else {
      params.delete("station");
    }
    router.push(`/fleet-finance?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold uppercase text-slate-500">Station</label>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      >
        {STATIONS.map((s) => (
          <option key={s} value={s}>{s || "All Stations"}</option>
        ))}
      </select>
    </div>
  );
}
