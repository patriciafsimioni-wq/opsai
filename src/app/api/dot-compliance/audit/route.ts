import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import {
  DOT_STATE,
  DOT_FEDERAL_RULES,
  DOT_STATE_RULES,
  STATION_LABEL,
} from "@/lib/constants";

const ALL_RULES = [...DOT_FEDERAL_RULES, ...DOT_STATE_RULES];

const DAY = 24 * 60 * 60 * 1000;

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Render an uploaded document (data URL): embed images inline so they print in
// the packet; link PDFs/others so they can be opened from the browser.
function docCell(url: string | null | undefined): string {
  if (!url) return '<span class="badge missing">NOT ON FILE</span>';
  // Browsers block top-level navigation to data: URLs, so a plain link opens a
  // blank tab. Carry the data URL in data-doc; a click handler (see script at
  // the end of the doc) turns it into a Blob URL and opens that instead.
  if (url.startsWith("data:image/")) return `<a href="#" class="doclink" data-doc="${esc(url)}"><img class="doc" src="${esc(url)}" alt="document"/></a>`;
  return `<a class="doclink" href="#" data-doc="${esc(url)}">Open document</a> <span class="badge valid">ON FILE</span>`;
}

function status(d: Date | null | undefined): { label: string; cls: string } {
  if (!d) return { label: "MISSING", cls: "missing" };
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / DAY);
  if (days < 0) return { label: "EXPIRED", cls: "expired" };
  if (days <= 30) return { label: `EXPIRING (${days}d)`, cls: "expiring" };
  return { label: "VALID", cls: "valid" };
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [drivers, companyDocs, audits, trucks] = await Promise.all([
    prisma.driver.findMany({
      where: { vehicleType: { in: ["BOX_TRUCK", "TRACTOR_TRUCK"] } },
      orderBy: [{ station: "asc" }, { firstName: "asc" }],
      include: { vehicles: { select: { name: true, dxNumber: true, licensePlate: true, vin: true } } },
    }),
    prisma.dotDocument.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.dotAudit.findMany({ orderBy: { auditDate: "desc" } }),
    prisma.vehicle.findMany({
      where: {
        type: "TRUCK",
        OR: [{ offboardStatus: null }, { offboardStatus: { notIn: ["IN_PROGRESS", "COMPLETED"] } }],
      },
      orderBy: [{ station: "asc" }, { name: "asc" }],
      select: { id: true, name: true, dxNumber: true, licensePlate: true, station: true, dotInspectionDate: true, dotInspectionExpiry: true, dotInspectionDocUrl: true },
    }),
  ]);

  const generated = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "America/Chicago" }) + " CT";

  const rulesRows = (title: string, rows: typeof DOT_FEDERAL_RULES) => `
    <h3>${esc(title)}</h3>
    <table class="rules">
      <thead><tr><th>Requirement</th><th>Rule</th><th>Cadence</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><td class="item">${esc(r.item)}</td><td>${esc(r.rule)}</td><td class="cadence">${esc(r.cadence)}</td></tr>`).join("")}
      </tbody>
    </table>`;

  const driverPages = drivers
    .map((d) => {
      const veh = d.vehicles.map((v) => v.name || v.dxNumber || v.licensePlate).filter(Boolean).join(", ") || "—";
      const vtype = d.vehicleType === "TRACTOR_TRUCK" ? "Tractor Truck" : "Box Truck";
      const items: { label: string; value: string; st: { label: string; cls: string } }[] = [
        { label: "DOT Medical Card Expiry", value: fmt(d.medicalCardExpiry), st: status(d.medicalCardExpiry) },
        { label: `CDL / License (Class ${esc(d.licenseClass ?? "—")}) Expiry`, value: fmt(d.licenseExpiry), st: status(d.licenseExpiry) },
        { label: "Annual Review", value: fmt(d.annualReviewAt), st: status(d.annualReviewAt) },
      ];
      const mvrSt = d.mvrCheckedAt
        ? (Date.now() - new Date(d.mvrCheckedAt).getTime() > 365 * DAY
            ? { label: "OVERDUE", cls: "expired" }
            : { label: "CURRENT", cls: "valid" })
        : { label: "MISSING", cls: "missing" };
      const drugSt = d.drugTestStatus === "PASS"
        ? { label: "PASS", cls: "valid" }
        : d.drugTestStatus === "FAIL"
          ? { label: "FAIL", cls: "expired" }
          : d.drugTestStatus === "PENDING"
            ? { label: "PENDING", cls: "expiring" }
            : { label: "MISSING", cls: "missing" };

      return `
      <section class="driver">
        <div class="dhead">
          <div>
            <div class="dname">${esc(d.firstName)} ${esc(d.lastName)}</div>
            <div class="dmeta">${esc(d.email)} · ${esc(d.phone ?? "")}</div>
          </div>
          <div class="dstation">${esc(STATION_LABEL[d.station ?? ""] ?? d.station ?? "—")}</div>
        </div>
        <table class="file">
          <tr><td class="k">Vehicle Type</td><td>${vtype}</td><td class="k">Assigned Vehicle(s)</td><td>${esc(veh)}</td></tr>
          <tr><td class="k">License Number</td><td>${esc(d.licenseNumber)}</td><td class="k">License Class</td><td>${esc(d.licenseClass ?? "—")}</td></tr>
        </table>
        <table class="items">
          <thead><tr><th>DOT File Item</th><th>Date / Value</th><th>Status</th></tr></thead>
          <tbody>
            ${items.map((i) => `<tr><td>${i.label}</td><td>${i.value}</td><td><span class="badge ${i.st.cls}">${i.st.label}</span></td></tr>`).join("")}
            <tr><td>MVR Last Checked</td><td>${fmt(d.mvrCheckedAt)}</td><td><span class="badge ${mvrSt.cls}">${mvrSt.label}</span></td></tr>
            <tr><td>Drug &amp; Alcohol Status</td><td>${esc(d.drugTestStatus ?? "—")}</td><td><span class="badge ${drugSt.cls}">${drugSt.label}</span></td></tr>
          </tbody>
        </table>
        <table class="items">
          <thead><tr><th>Document on File</th><th>Attachment</th></tr></thead>
          <tbody>
            ${([
              ["DOT Medical Card", d.medicalCardDocUrl],
              ["CDL / License", d.licenseDocUrl],
              ["MVR", d.mvrDocUrl],
              ["Drug & Alcohol", d.drugTestDocUrl],
              ["Annual Review", d.annualReviewDocUrl],
            ] as [string, string | null][]).map(([label, url]) => `<tr><td>${esc(label)}</td><td>${docCell(url)}</td></tr>`).join("")}
          </tbody>
        </table>
        <div class="sign">
          <div>Reviewed by: ______________________________</div>
          <div>Date: ______________</div>
        </div>
      </section>`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(BRAND)} DOT Compliance Audit Packet</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
  .toolbar { position: sticky; top: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .toolbar button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h3 { font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: #334155; }
  .sub { color: #475569; font-size: 13px; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .rules th, .rules td, .items th, .items td { border: 1px solid #e2e8f0; padding: 7px 9px; text-align: left; vertical-align: top; }
  .rules th, .items th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  .rules .item { font-weight: 600; width: 26%; }
  .rules .cadence { width: 20%; color: #475569; }
  .driver { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
  .dhead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .dname { font-size: 16px; font-weight: 700; }
  .dmeta { font-size: 12px; color: #64748b; }
  .dstation { font-size: 12px; font-weight: 600; background: #eff6ff; color: #1e40af; padding: 4px 10px; border-radius: 999px; }
  .file { margin-bottom: 10px; }
  .file .k { font-weight: 600; color: #475569; width: 16%; background: #f8fafc; }
  .file td { border: 1px solid #e2e8f0; padding: 6px 9px; }
  .items { margin-bottom: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .badge.valid { background: #dcfce7; color: #166534; }
  .badge.expiring { background: #fef9c3; color: #854d0e; }
  .badge.expired { background: #fee2e2; color: #991b1b; }
  .badge.missing { background: #f1f5f9; color: #475569; }
  .doc { max-height: 220px; max-width: 320px; border: 1px solid #cbd5e1; border-radius: 6px; margin: 4px 0; display: block; }
  .doclink { color: #2563eb; font-weight: 600; text-decoration: none; }
  .docrow { display: flex; align-items: center; gap: 8px; margin: 3px 0; flex-wrap: wrap; }
  .sign { display: flex; justify-content: space-between; font-size: 12px; color: #334155; margin-top: 8px; }
  .page-break { page-break-before: always; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style></head>
<body>
  <div class="toolbar">
    <span>${esc(BRAND)} — DOT Compliance Audit Packet · ${drivers.length} driver(s)</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <h1>${esc(BRAND)} — DOT Compliance Audit Packet</h1>
  <p class="sub">${DOT_STATE.name} (${DOT_STATE.code}) motor-carrier compliance · ${esc(DOT_STATE.agency)}</p>
  <p class="sub">Box Truck &amp; Tractor Truck drivers · Generated ${esc(generated)}</p>

  ${rulesRows("Federal FMCSA Requirements (49 CFR)", DOT_FEDERAL_RULES)}
  ${rulesRows(`${DOT_STATE.name} State Requirements`, DOT_STATE_RULES)}

  <h3>DOT Audit History</h3>
  <table class="rules">
    <thead><tr><th>Date</th><th>Officer</th><th>Agency</th><th>Result</th><th>Report</th></tr></thead>
    <tbody>
      ${audits.length ? audits.map((a) => `<tr><td class="item">${fmt(a.auditDate)}</td><td>${esc(a.officerName ?? "—")}</td><td>${esc(a.agency ?? "—")}</td><td>${esc(a.result ?? "—")}</td><td>${docCell(a.docUrl)}</td></tr>`).join("") : '<tr><td colspan="5">No DOT audit logged.</td></tr>'}
    </tbody>
  </table>

  <h3>Company / Fleet Documents on File</h3>
  <table class="rules">
    <thead><tr><th>Requirement</th><th>Documents</th></tr></thead>
    <tbody>
      ${ALL_RULES.map((r) => {
        const docs = companyDocs.filter((d) => d.requirement === r.key);
        return `<tr><td class="item">${esc(r.item)}</td><td>${docs.length ? docs.map((d) => `<div class="docrow">${esc(d.title)}${docCell(d.docUrl)}</div>`).join("") : '<span class="badge missing">NOT ON FILE</span>'}</td></tr>`;
      }).join("")}
    </tbody>
  </table>

  <h3>Truck DOT Annual Safety Inspections (49 CFR 396.17) · ${trucks.length} truck(s)</h3>
  <table class="rules">
    <thead><tr><th>Vehicle</th><th>Station</th><th>Last Inspection</th><th>Expiry</th><th>Status</th><th>Report</th></tr></thead>
    <tbody>
      ${trucks.length ? trucks.map((t) => {
        const st = status(t.dotInspectionExpiry);
        return `<tr><td class="item">${esc(t.name || t.dxNumber || t.licensePlate || "—")}</td><td>${esc(STATION_LABEL[t.station ?? ""] ?? t.station ?? "—")}</td><td>${fmt(t.dotInspectionDate)}</td><td>${fmt(t.dotInspectionExpiry)}</td><td><span class="badge ${st.cls}">${st.label}</span></td><td>${docCell(t.dotInspectionDocUrl)}</td></tr>`;
      }).join("") : '<tr><td colspan="6">No trucks on file.</td></tr>'}
    </tbody>
  </table>

  <div class="page-break"></div>
  <h3>Driver Qualification Files (${drivers.length})</h3>
  ${driverPages || '<p class="sub">No Box Truck or Tractor Truck drivers on file.</p>'}
  <script>
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-doc]");
      if (!a) return;
      e.preventDefault();
      var url = a.getAttribute("data-doc");
      if (!url) return;
      fetch(url)
        .then(function (r) { return r.blob(); })
        .then(function (b) { window.open(URL.createObjectURL(b), "_blank"); })
        .catch(function () { window.open(url, "_blank"); });
    });
  </script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
