import { prisma } from "@/lib/db";
import { sendEmail, buildAlertDigestEmail, getAppUrl } from "@/lib/email";
import { canManage } from "@/lib/auth";

const DAYS_AHEAD = 30;
const DAY = 24 * 60 * 60 * 1000;

type NewAlert = {
  severity: string;
  message: string;
  context?: string | null;
  // Stable identity of the compliance item (subject + document + date/state),
  // used to make sure each item is emailed only once.
  notifyKey: string;
  stations: string[];
};

function splitStations(s: string | null | undefined): string[] {
  return (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// Email each station's managers only the items for their own station(s), and
// only items never emailed before. Users without an assigned station are not
// emailed. With send=false the items are recorded as notified without
// emailing (used to seed history). Never throws.
async function notifyFlaggedIssues(newAlerts: NewAlert[], send: boolean) {
  if (newAlerts.length === 0) return { emailed: 0, items: 0 };
  const keys = [...new Set(newAlerts.map((a) => a.notifyKey))];
  const already = await prisma.alertNotification.findMany({
    where: { key: { in: keys } },
    select: { key: true },
  });
  const sent = new Set(already.map((a) => a.key));
  const fresh: NewAlert[] = [];
  for (const a of newAlerts) {
    if (sent.has(a.notifyKey)) continue;
    sent.add(a.notifyKey);
    fresh.push(a);
  }
  if (fresh.length === 0) return { emailed: 0, items: 0 };

  await prisma.alertNotification.createMany({
    data: fresh.map((a) => ({ key: a.notifyKey, station: a.stations.join(",") || null })),
    skipDuplicates: true,
  });
  if (!send) return { emailed: 0, items: fresh.length };

  const users = await prisma.user.findMany({ select: { email: true, name: true, role: true, station: true } });
  const appUrl = getAppUrl();
  const outgoing: Promise<unknown>[] = [];
  for (const u of users) {
    if (!u.email || !canManage(u.role)) continue;
    const mine = splitStations(u.station);
    if (mine.length === 0) continue;
    const alerts = fresh.filter((a) => a.stations.some((s) => mine.includes(s)));
    if (alerts.length === 0) continue;
    const email = buildAlertDigestEmail({
      recipientName: u.name || "there",
      alerts,
      appUrl,
      stationLabel: mine.join(", "),
    });
    outgoing.push(sendEmail({ to: u.email, ...email }));
  }
  // Await all sends: on Vercel the serverless function freezes once the
  // response returns, dropping any fire-and-forget promise.
  await Promise.allSettled(outgoing);
  return { emailed: outgoing.length, items: fresh.length };
}

// "Registration expires Oct 1, 2026 (in 3 days)" / "Registration expired on …" → "Registration"
const vehicleDocLabel = (message: string) => message.split(/ expire[sd]\b/)[0];

// Scan vehicles for registration/insurance documents expiring within DAYS_AHEAD
// days and open a DOCUMENT_EXPIRY alert for each (skipping duplicates that are
// still unresolved). Safe to run repeatedly (idempotent).
export async function generateComplianceAlerts({ send = true }: { send?: boolean } = {}) {
  const newAlerts: NewAlert[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + DAYS_AHEAD * DAY);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      status: { not: "OUT_OF_SERVICE" },
      OR: [
        { offboardStatus: null },
        { offboardStatus: { notIn: ["IN_PROGRESS", "COMPLETED"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      dxNumber: true,
      station: true,
      registrationExpiry: true,
      insuranceExpiry: true,
    },
  });

  const docs: { vehicleId: string; label: string; date: Date; name: string; station: string }[] = [];
  for (const v of vehicles) {
    const label = v.name || v.dxNumber || "Vehicle";
    if (v.registrationExpiry && v.registrationExpiry <= cutoff) {
      docs.push({ vehicleId: v.id, label: "Registration", date: v.registrationExpiry, name: label, station: v.station });
    }
    if (v.insuranceExpiry && v.insuranceExpiry <= cutoff) {
      docs.push({ vehicleId: v.id, label: "Insurance", date: v.insuranceExpiry, name: label, station: v.station });
    }
  }

  const existing = await prisma.alert.findMany({
    where: { type: "DOCUMENT_EXPIRY", resolvedAt: null, vehicleId: { not: null } },
    select: { vehicleId: true, message: true },
  });
  const existingKey = new Set(existing.map((a) => `${a.vehicleId}|${vehicleDocLabel(a.message)}`));

  let created = 0;
  for (const d of docs) {
    const days = Math.ceil((d.date.getTime() - now.getTime()) / DAY);
    const expired = days < 0;
    const severity = expired || days <= 7 ? "CRITICAL" : "WARNING";
    const dateStr = d.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const message = expired
      ? `${d.label} expired on ${dateStr}`
      : `${d.label} expires ${dateStr} (in ${days} day${days === 1 ? "" : "s"})`;
    newAlerts.push({
      severity,
      message,
      context: d.name,
      notifyKey: `vehicle:${d.vehicleId}|${d.label}|${isoDay(d.date)}`,
      stations: [d.station],
    });
    const key = `${d.vehicleId}|${d.label}`;
    if (existingKey.has(key)) continue;
    await prisma.alert.create({
      data: { type: "DOCUMENT_EXPIRY", severity, message, vehicleId: d.vehicleId },
    });
    existingKey.add(key);
    created++;
  }

  const dotResult = await generateDotAlerts(now, cutoff, newAlerts);

  const notified = await notifyFlaggedIssues(newAlerts, send);

  return {
    scanned: vehicles.length,
    expiringDocs: docs.length,
    created: created + dotResult.created,
    dotAlerts: dotResult.created,
    newlyNotified: notified.items,
    emailsSent: notified.emailed,
  };
}

// Scan Box Truck / Tractor Truck drivers for expiring or missing DOT file items
// (medical card, CDL, annual review, MVR overdue, drug & alcohol) and open a
// DOCUMENT_EXPIRY alert per driver+item. Idempotent (skips existing unresolved).
async function generateDotAlerts(now: Date, cutoff: Date, newAlerts: NewAlert[]) {
  const YEAR = 365 * DAY;
  const drivers = await prisma.driver.findMany({
    where: { vehicleType: { in: ["BOX_TRUCK", "TRACTOR_TRUCK"] }, status: { not: "INACTIVE" } },
    select: {
      id: true, firstName: true, lastName: true, station: true,
      vehicles: { select: { station: true } },
      medicalCardExpiry: true, licenseExpiry: true, annualReviewAt: true,
      mvrCheckedAt: true, drugTestStatus: true,
      medicalCardDocUrl: true, licenseDocUrl: true, mvrDocUrl: true,
      drugTestDocUrl: true, annualReviewDocUrl: true,
    },
  });

  type Item = { driverId: string; message: string; critical: boolean; state: string; label: string; stations: string[] };
  const items: Item[] = [];
  const dateStr = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const days = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / DAY);

  for (const d of drivers) {
    const who = `${d.firstName} ${d.lastName}`;
    const own = splitStations(d.station);
    const stations = own.length > 0 ? own : [...new Set(d.vehicles.map((v) => v.station))];
    const push = (label: string, state: string, message: string, critical: boolean) =>
      items.push({ driverId: d.id, label, state, message, critical, stations });
    const expiryItem = (label: string, date: Date | null) => {
      if (!date) { push(label, "missing", `${label} missing for ${who}`, true); return; }
      if (date <= cutoff) {
        const n = days(date);
        push(label, isoDay(date), n < 0 ? `${label} expired ${dateStr(date)} for ${who}` : `${label} expires ${dateStr(date)} (in ${n} day${n === 1 ? "" : "s"}) for ${who}`, n < 0 || n <= 7);
      }
    };
    expiryItem("DOT medical card", d.medicalCardExpiry);
    expiryItem("CDL / license", d.licenseExpiry);
    expiryItem("Annual review", d.annualReviewAt);
    if (!d.mvrCheckedAt) push("MVR", "missing", `MVR not on file for ${who}`, true);
    else if (now.getTime() - d.mvrCheckedAt.getTime() > YEAR) push("MVR", `overdue-${isoDay(d.mvrCheckedAt)}`, `MVR review overdue (last ${dateStr(d.mvrCheckedAt)}) for ${who}`, true);
    if (d.drugTestStatus !== "PASS") push("Drug & alcohol", d.drugTestStatus ?? "missing", `Drug & alcohol status ${d.drugTestStatus ?? "missing"} for ${who}`, d.drugTestStatus === "FAIL");
    const missingDocs: [string, string | null][] = [
      ["Medical card document", d.medicalCardDocUrl],
      ["CDL / license document", d.licenseDocUrl],
      ["MVR document", d.mvrDocUrl],
      ["Drug & alcohol document", d.drugTestDocUrl],
      ["Annual review document", d.annualReviewDocUrl],
    ];
    for (const [label, url] of missingDocs) {
      if (!url) push(label, "missing", `${label} not uploaded for ${who}`, false);
    }
  }

  // Clear any lingering open DOT alerts for drivers that are now inactive, so
  // deactivated drivers stop showing up anywhere under compliance.
  const inactiveDrivers = await prisma.driver.findMany({
    where: { status: "INACTIVE" },
    select: { id: true },
  });
  if (inactiveDrivers.length > 0) {
    await prisma.alert.updateMany({
      where: {
        type: "DOCUMENT_EXPIRY",
        resolvedAt: null,
        driverId: { in: inactiveDrivers.map((d) => d.id) },
      },
      data: { resolvedAt: new Date() },
    });
  }

  const existing = await prisma.alert.findMany({
    where: { type: "DOCUMENT_EXPIRY", resolvedAt: null, driverId: { not: null } },
    select: { driverId: true, message: true },
  });
  const key4 = (m: string) => m.split(" ").slice(0, 4).join(" ");
  const existingKey = new Set(existing.map((a) => `${a.driverId}|${key4(a.message)}`));

  let created = 0;
  for (const it of items) {
    const severity = it.critical ? "CRITICAL" : "WARNING";
    newAlerts.push({
      severity,
      message: it.message,
      notifyKey: `driver:${it.driverId}|${it.label}|${it.state}`,
      stations: it.stations,
    });
    const key = `${it.driverId}|${key4(it.message)}`;
    if (existingKey.has(key)) continue;
    await prisma.alert.create({
      data: { type: "DOCUMENT_EXPIRY", severity, message: it.message, driverId: it.driverId },
    });
    existingKey.add(key);
    created++;
  }
  return { created };
}
