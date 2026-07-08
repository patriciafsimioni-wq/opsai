import { prisma } from "@/lib/db";
import { requireManager, stationWhere } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { STATION_LABEL } from "@/lib/constants";

const DAY = 24 * 60 * 60 * 1000;

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function monthsBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (30 * DAY));
}

export async function GET() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const where = stationWhere(auth.user);
  const vehicles = await prisma.vehicle.findMany({
    where: {
      leasingCompany: { not: null },
      ...(where ?? {}),
    },
    orderBy: [{ leasingCompany: "asc" }, { station: "asc" }, { name: "asc" }],
  });

  const now = new Date();
  const generated = now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });

  type Assessed = {
    v: (typeof vehicles)[number];
    ageYears: number;
    maxAge: number;
    monthsLeft: number | null;
    overMileage: number;
    excessExposure: number | null;
    returnState: { label: string; cls: string; rank: number };
  };

  const assess = (v: (typeof vehicles)[number]): Assessed => {
    const ageYears = v.year ? now.getFullYear() - v.year : 0;
    const maxAge = v.type === "VAN" ? 4 : 7;
    const monthsLeft =
      v.monthsLeftPayoff ??
      (v.leaseEndDate ? monthsBetween(now, new Date(v.leaseEndDate)) : null);
    const leaseEnded = v.leaseEndDate ? new Date(v.leaseEndDate).getTime() <= now.getTime() : false;
    const overMileage = v.contractMileage && v.contractMileage > 0 ? Math.max(0, v.odometer - v.contractMileage) : 0;
    const excessExposure =
      overMileage > 0 && v.excessMileageRate != null && v.excessMileageRate > 0
        ? overMileage * v.excessMileageRate
        : null;

    // A vehicle that's been off-boarded OR is going through the off-boarding
    // process (return/sale/disposal underway) is done — it shows as RETURNED,
    // never as due for return.
    const OFFBOARD_LIFECYCLE = new Set(["READY_DISPOSAL", "SOLD_RETURNED", "ARCHIVED"]);
    const returned =
      v.offboardStatus === "IN_PROGRESS" ||
      v.offboardStatus === "COMPLETED" ||
      OFFBOARD_LIFECYCLE.has(v.lifecycleStatus);

    // Return-due assessment: overdue drives red, approaching drives amber.
    let returnState: { label: string; cls: string; rank: number };
    if (returned) {
      returnState = { label: "RETURNED", cls: "returned", rank: 3 };
    } else if (leaseEnded || (monthsLeft != null && monthsLeft <= 0) || ageYears >= maxAge) {
      returnState = { label: "RETURN DUE", cls: "due", rank: 0 };
    } else if ((monthsLeft != null && monthsLeft <= 3) || ageYears >= maxAge - 1) {
      returnState = { label: "RETURN SOON", cls: "soon", rank: 1 };
    } else {
      returnState = { label: "IN SERVICE", cls: "ok", rank: 2 };
    }
    return { v, ageYears, maxAge, monthsLeft, overMileage, excessExposure, returnState };
  };

  const rows = vehicles.map(assess).sort((a, b) => {
    if (a.returnState.rank !== b.returnState.rank) return a.returnState.rank - b.returnState.rank;
    return (a.v.leasingCompany ?? "").localeCompare(b.v.leasingCompany ?? "");
  });

  const dueCount = rows.filter((r) => r.returnState.rank === 0).length;
  const soonCount = rows.filter((r) => r.returnState.rank === 1).length;
  const returnedCount = rows.filter((r) => r.returnState.rank === 3).length;

  // Net equity across the fleet = Σ (market value − remaining lease obligation).
  // Positive means worth more than what's left to pay; negative = underwater.
  const netEquity = rows.reduce((sum, r) => {
    const rent = r.v.totalRentPerMonth ?? r.v.leaseChargePerMonth;
    const market = r.v.currentMarketValue;
    if (rent == null || r.monthsLeft == null || market == null) return sum;
    return sum + (market - rent * Math.max(r.monthsLeft, 0));
  }, 0);

  // Group rows by leasing company for per-lessor sections.
  const byLessor = new Map<string, Assessed[]>();
  for (const r of rows) {
    const key = r.v.leasingCompany ?? "Unassigned";
    if (!byLessor.has(key)) byLessor.set(key, []);
    byLessor.get(key)!.push(r);
  }

  // Remaining lease obligation = remaining monthly payments (rent × months left).
  const remainingObligationOf = (a: Assessed) => {
    const rent = a.v.totalRentPerMonth ?? a.v.leaseChargePerMonth;
    if (rent == null || a.monthsLeft == null) return null;
    return rent * Math.max(a.monthsLeft, 0);
  };
  // Equity = market value − remaining lease obligation. Positive means the
  // vehicle is worth more than what's left to pay; negative means underwater.
  const equityOf = (a: Assessed) => {
    const obligation = remainingObligationOf(a);
    const market = a.v.currentMarketValue;
    if (obligation == null || market == null) return null;
    return market - obligation;
  };
  const equityCell = (a: Assessed) => {
    const eq = equityOf(a);
    if (eq == null) return "—";
    const cls = eq >= 0 ? "eq-pos" : "eq-neg";
    const sign = eq >= 0 ? "+" : "−";
    return `<span class="${cls}">${sign}${fmtMoney(Math.abs(eq))}</span>`;
  };

  const detailRow = (a: Assessed) => {
    const v = a.v;
    return `
      <tr>
        <td class="k">${esc(v.name || v.dxNumber || "—")}</td>
        <td>${esc(v.year ?? "—")} ${esc(v.make)} ${esc(v.model)}</td>
        <td>${a.ageYears} yr${a.ageYears === 1 ? "" : "s"} (max ${a.maxAge})</td>
        <td>${esc(v.vin)}</td>
        <td>${esc(v.licensePlate ?? "—")}</td>
        <td>${esc(STATION_LABEL[v.station ?? ""]?.split(" - ")[0] ?? v.station ?? "—")}</td>
        <td>${esc(v.leaseType ?? "—")}${v.leaseTerm ? ` · ${v.leaseTerm} mo` : ""}</td>
        <td>${fmtDate(v.leaseStartDate)}</td>
        <td>${fmtDate(v.leaseEndDate)}</td>
        <td>${a.monthsLeft == null ? "—" : a.monthsLeft <= 0 ? "0 (ended)" : a.monthsLeft}</td>
        <td>${fmtMoney(v.totalRentPerMonth ?? v.leaseChargePerMonth)}</td>
        <td>${fmtNum(v.odometer)} / ${fmtNum(v.contractMileage)}</td>
        <td>${a.overMileage > 0 ? `<span class="over">+${fmtNum(a.overMileage)}</span>` : "—"}</td>
        <td>${fmtMoney(v.currentBookValue ?? v.openEndNetBookValue)}</td>
        <td>${fmtMoney(v.currentMarketValue)}</td>
        <td>${equityCell(a)}</td>
        <td><span class="badge ${a.returnState.cls}">${a.returnState.label}</span></td>
      </tr>`;
  };

  const lessorSections = [...byLessor.entries()]
    .map(([lessor, list]) => {
      const due = list.filter((r) => r.returnState.rank === 0).length;
      return `
      <section class="lessor">
        <h3>${esc(lessor)} · ${list.length} vehicle(s)${due ? ` · ${due} due for return` : ""}</h3>
        <div class="scroll">
        <table class="grid">
          <thead>
            <tr>
              <th>Vehicle</th><th>Description</th><th>Age</th><th>VIN</th><th>Plate</th><th>Station</th>
              <th>Lease Type</th><th>Lease Start</th><th>Lease End</th><th>Months Left</th><th>Rent/Mo</th>
              <th>Odo / Contract</th><th>Over Miles</th><th>Book Value</th><th>Market Value</th><th>Equity</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${list.map(detailRow).join("")}</tbody>
        </table>
        </div>
      </section>`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(BRAND)} Vehicle Age & Lease Return Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
  .toolbar { position: sticky; top: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .toolbar button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h3 { font-size: 14px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: #334155; }
  .sub { color: #475569; font-size: 13px; margin: 0; }
  .summary { display: flex; gap: 16px; margin: 16px 0 8px; }
  .tile { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 16px; text-align: center; }
  .tile .n { font-size: 22px; font-weight: 800; }
  .tile.due .n { color: #991b1b; } .tile.soon .n { color: #854d0e; } .tile.returned .n { color: #3730a3; } .tile.total .n { color: #1e40af; }
  .tile .l { font-size: 11px; text-transform: uppercase; color: #64748b; }
  .scroll { overflow-x: auto; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.grid th, table.grid td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; white-space: nowrap; }
  table.grid th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  table.grid td.k { font-weight: 600; }
  .over { color: #991b1b; font-weight: 600; }
  .eq-pos { color: #166534; font-weight: 700; }
  .eq-neg { color: #991b1b; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge.due { background: #fee2e2; color: #991b1b; }
  .badge.soon { background: #fef9c3; color: #854d0e; }
  .badge.ok { background: #dcfce7; color: #166534; }
  .badge.returned { background: #e0e7ff; color: #3730a3; }
  .lessor { page-break-inside: auto; margin-bottom: 8px; }
  @media print {
    @page { size: A4 landscape; margin: 8mm; }
    .toolbar { display: none; }
    body { padding: 0; }
    .scroll { overflow: visible !important; }
    table.grid { font-size: 8px; }
    table.grid th, table.grid td { white-space: normal; word-break: break-word; }
    .lessor { page-break-inside: auto; }
    .summary { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body>
  <div class="toolbar">
    <span>${esc(BRAND)} — Vehicle Age &amp; Lease Return Report · ${rows.length} leased vehicle(s)</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <h1>${esc(BRAND)} — Vehicle Age &amp; Lease Return Report</h1>
  <p class="sub">Leased fleet return assessment for leasing companies · Generated ${esc(generated)}</p>
  <div class="summary">
    <div class="tile due"><div class="n">${dueCount}</div><div class="l">Return Due</div></div>
    <div class="tile soon"><div class="n">${soonCount}</div><div class="l">Return Soon (≤3 mo)</div></div>
    <div class="tile returned"><div class="n">${returnedCount}</div><div class="l">Returned</div></div>
    <div class="tile total"><div class="n">${rows.length}</div><div class="l">Total Leased</div></div>
    <div class="tile"><div class="n ${netEquity >= 0 ? "eq-pos" : "eq-neg"}">${netEquity >= 0 ? "+" : "−"}${fmtMoney(Math.abs(netEquity))}</div><div class="l">Net Equity (Mkt − Remaining Obligation)</div></div>
  </div>
  <p class="sub">Return-due criteria: lease end date reached, no lease months remaining, or vehicle age at/over the age limit (vans 4 yrs, trucks 7 yrs). &quot;Return Soon&quot; = within 3 months or one year of the age limit.</p>
  ${rows.length ? lessorSections : '<p class="sub">No leased vehicles on file.</p>'}
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
