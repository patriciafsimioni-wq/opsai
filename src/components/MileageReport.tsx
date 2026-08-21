"use client";

import { Gauge } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { GroupedBarChart } from "@/components/charts";
import { useData } from "@/lib/use-data";
import { useFleetView } from "@/lib/use-fleet-view";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { STATION_LABEL } from "@/lib/constants";
import { ExportButton } from "@/components/ReportsExport";

type Period = {
  key: string;
  label: string;
  Miles: number;
  fuel: number;
  maint: number;
  gallons: number;
  costPerMile: number | null;
  mpg: number | null;
};

type MileageApiResponse = {
  range: "week" | "month";
  trend: Period[];
  current: Period;
  previous: Period | null;
  byStation: { label: string; value: number }[];
  perVehicle: {
    id: string;
    label: string;
    station: string | null;
    miles: number;
    fuel: number;
    maint: number;
    gallons: number;
    lastReadAt: string | null;
    lastMiles: number | null;
    source: "Samsara" | "Records" | "No data";
  }[];
  coverage: {
    vehicles: number;
    vehiclesWithData: number;
    vehiclesWithoutReadings: number;
    vehiclesWithTelemetry: number;
    vehiclesUnreliable: number;
    rejectedReadings: number;
    readings: number;
  };
};

/** Actual miles driven per week/month, derived from odometer history, with the
 *  cost per mile and MPG of the same period. */
export function MileageReport({
  range,
  refDate,
  station,
}: {
  range: "week" | "month";
  refDate: string;
  station: string;
}) {
  const fleetView = useFleetView();
  const { data, loading } = useData<MileageApiResponse>(
    `/api/mileage?range=${range}&date=${refDate}${station ? `&station=${station}` : ""}&fv=${fleetView}`,
  );

  const trend = data?.trend ?? [];
  const current = data?.current;
  const previous = data?.previous;
  const perVehicle = data?.perVehicle ?? [];
  const coverage = data?.coverage;
  const unit = range === "week" ? "week" : "month";

  const change =
    current && previous && previous.Miles > 0
      ? Math.round(((current.Miles - previous.Miles) / previous.Miles) * 100)
      : null;

  return (
    <Card>
      <CardHeader
        title="Mileage & Cost per Mile"
        subtitle={`Actual miles driven per ${unit} · last 12 ${unit}s`}
        action={
          <ExportButton
            rows={trend.map((r) => ({
              Period: r.key,
              Miles: r.Miles,
              Gallons: r.gallons,
              MPG: r.mpg ?? "",
              "Fuel Cost": r.fuel,
              "Maintenance Cost": r.maint,
              "Cost per Mile": r.costPerMile ?? "",
            }))}
            filename={`mileage-by-${unit}.csv`}
            label="Download CSV"
          />
        }
      />

      {loading && !data ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading mileage…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 border-b border-[var(--color-border)] p-4 lg:grid-cols-4">
            <Metric
              label={`Miles this ${unit}`}
              value={formatNumber(current?.Miles ?? 0)}
              note={change === null ? undefined : `${change > 0 ? "+" : ""}${change}% vs prior ${unit}`}
            />
            <Metric
              label="Cost per mile"
              value={current?.costPerMile != null ? `$${current.costPerMile.toFixed(3)}` : "—"}
              note="Fuel + maintenance ÷ miles"
            />
            <Metric label="MPG" value={current?.mpg != null ? current.mpg.toFixed(1) : "—"} note="Miles ÷ gallons" />
            <Metric
              label={`Spend this ${unit}`}
              value={formatCurrency((current?.fuel ?? 0) + (current?.maint ?? 0))}
              note={`Fuel ${formatCurrency(current?.fuel ?? 0)} · Maint ${formatCurrency(current?.maint ?? 0)}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <GroupedBarChart
                data={trend as unknown as Record<string, number | string>[]}
                bars={[{ key: "Miles", color: "#2563eb", name: "Miles driven" }]}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{range === "week" ? "Week of" : "Month"}</th>
                    <th className="px-3 py-2 text-right font-medium">Miles</th>
                    <th className="px-3 py-2 text-right font-medium">$/mi</th>
                    <th className="px-3 py-2 text-right font-medium">MPG</th>
                  </tr>
                </thead>
                <tbody>
                  {[...trend].reverse().map((r) => (
                    <tr key={r.key} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-1.5 text-slate-700">{r.label}</td>
                      <td className="px-3 py-1.5 text-right">{r.Miles ? formatNumber(r.Miles) : "—"}</td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {r.costPerMile != null ? `$${r.costPerMile.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {r.mpg != null ? r.mpg.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between px-4 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Gauge size={14} className="text-blue-600" />
                By vehicle · this {unit}
              </p>
              <ExportButton
                rows={perVehicle.map((v) => ({
                  Vehicle: v.label,
                  Station: v.station ?? "",
                  Miles: v.miles,
                  Gallons: v.gallons,
                  MPG: v.miles > 0 && v.gallons > 0 ? Math.round((v.miles / v.gallons) * 10) / 10 : "",
                  "Fuel Cost": v.fuel,
                  "Maintenance Cost": v.maint,
                  "Cost per Mile": v.miles > 0 ? Math.round(((v.fuel + v.maint) / v.miles) * 1000) / 1000 : "",
                  "Last Odometer": v.lastMiles ?? "",
                  "Last Reading": v.lastReadAt ? v.lastReadAt.slice(0, 10) : "",
                  Source: v.source,
                }))}
                filename={`mileage-by-vehicle-${unit}.csv`}
                label="Download CSV"
              />
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Vehicle</th>
                    <th className="px-3 py-2 text-left font-medium">Station</th>
                    <th className="px-3 py-2 text-right font-medium">Miles</th>
                    <th className="px-3 py-2 text-right font-medium">Fuel</th>
                    <th className="px-3 py-2 text-right font-medium">Maint</th>
                    <th className="px-3 py-2 text-right font-medium">$/mi</th>
                    <th className="px-3 py-2 text-right font-medium">MPG</th>
                    <th className="px-3 py-2 text-right font-medium">Odometer</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {perVehicle.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-400">
                        No odometer readings in this {unit} yet.
                      </td>
                    </tr>
                  ) : (
                    perVehicle.map((v) => {
                      const cpm = v.miles > 0 ? (v.fuel + v.maint) / v.miles : null;
                      const mpg = v.miles > 0 && v.gallons > 0 ? v.miles / v.gallons : null;
                      return (
                        <tr key={v.id} className="border-t border-[var(--color-border)]">
                          <td className="px-4 py-1.5 font-medium text-slate-800">{v.label}</td>
                          <td className="px-3 py-1.5 text-slate-500">
                            {v.station ? STATION_LABEL[v.station] ?? v.station : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right">{v.miles ? formatNumber(v.miles) : "—"}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">{formatCurrency(v.fuel)}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">{formatCurrency(v.maint)}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">
                            {cpm != null ? `$${cpm.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-600">
                            {mpg != null ? mpg.toFixed(1) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-500">
                            {v.lastMiles != null ? formatNumber(v.lastMiles) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-slate-500">
                            {v.source === "Samsara" ? (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">Samsara</span>
                            ) : v.source === "Records" ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Fuel/WO</span>
                            ) : (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">No data</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {coverage && (
              <p className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-slate-400">
                {formatNumber(coverage.readings)} odometer readings ·{" "}
                {coverage.vehiclesWithData} of {coverage.vehicles} vehicles reporting
                {coverage.vehiclesWithoutReadings > 0
                  ? ` · ${coverage.vehiclesWithoutReadings} with no usable readings`
                  : ""}
                {coverage.vehiclesWithTelemetry > 0
                  ? ` · ${coverage.vehiclesWithTelemetry} on Samsara telematics`
                  : ""}
                {coverage.vehiclesUnreliable > 0
                  ? ` · ${coverage.vehiclesUnreliable} skipped (pump-entered odometers contradict each other)`
                  : ""}
                {coverage.rejectedReadings > 0
                  ? ` · ${formatNumber(coverage.rejectedReadings)} readings ignored as impossible (odometer keyed wrong)`
                  : ""}
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  );
}
