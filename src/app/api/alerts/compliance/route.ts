import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { sendEmail, buildAlertDigestEmail, getAppUrl } from "@/lib/email";
import { canManage } from "@/lib/auth";

const DAYS_AHEAD = 30;

type NewAlert = { severity: string; message: string; context?: string | null };

// Email a digest of newly-flagged issues to users who can manage the fleet.
// Non-blocking: never fails the alert run. Only called with freshly-created
// alerts, so cron re-runs (which skip existing alerts) don't re-notify.
async function notifyFlaggedIssues(newAlerts: NewAlert[]) {
  if (newAlerts.length === 0) return;
  const users = await prisma.user.findMany({ select: { email: true, name: true, role: true } });
  const recipients = users.filter((u) => u.email && canManage(u.role));
  const appUrl = getAppUrl();
  // Await all sends: on Vercel the serverless function freezes once the
  // response returns, dropping any fire-and-forget promise. Never throw.
  await Promise.allSettled(
    recipients.map((r) => {
      const email = buildAlertDigestEmail({ recipientName: r.name || "there", alerts: newAlerts, appUrl });
      return sendEmail({ to: r.email, ...email });
    }),
  );
}

// Scan vehicles for registration/insurance documents expiring within DAYS_AHEAD
// days and open a DOCUMENT_EXPIRY alert for each (skipping duplicates that are
// still unresolved). Designed to be safe to run repeatedly (idempotent).
async function generateComplianceAlerts() {
  const newAlerts: NewAlert[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { offboardStatus: null },
        { offboardStatus: { notIn: ["IN_PROGRESS", "COMPLETED"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      dxNumber: true,
      registrationExpiry: true,
      insuranceExpiry: true,
    },
  });

  const docs: { vehicleId: string; label: string; date: Date; name: string }[] = [];
  for (const v of vehicles) {
    const label = v.name || v.dxNumber || "Vehicle";
    if (v.registrationExpiry && v.registrationExpiry <= cutoff) {
      docs.push({ vehicleId: v.id, label: "Registration", date: v.registrationExpiry, name: label });
    }
    if (v.insuranceExpiry && v.insuranceExpiry <= cutoff) {
      docs.push({ vehicleId: v.id, label: "Insurance", date: v.insuranceExpiry, name: label });
    }
  }

  // Existing unresolved document-expiry alerts, to avoid duplicates.
  const existing = await prisma.alert.findMany({
    where: { type: "DOCUMENT_EXPIRY", resolvedAt: null },
    select: { vehicleId: true, message: true },
  });
  const existingKey = new Set(existing.map((a) => `${a.vehicleId}|${a.message.split(" expires")[0]}`));

  let created = 0;
  for (const d of docs) {
    const days = Math.ceil((d.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const key = `${d.vehicleId}|${d.label}`;
    if (existingKey.has(key)) continue;
    const dateStr = d.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const expired = days < 0;
    const message = expired
      ? `${d.label} expired on ${dateStr}`
      : `${d.label} expires ${dateStr} (in ${days} day${days === 1 ? "" : "s"})`;
    await prisma.alert.create({
      data: {
        type: "DOCUMENT_EXPIRY",
        severity: expired || days <= 7 ? "CRITICAL" : "WARNING",
        message,
        vehicleId: d.vehicleId,
      },
    });
    existingKey.add(key);
    newAlerts.push({ severity: expired || days <= 7 ? "CRITICAL" : "WARNING", message, context: d.name });
    created++;
  }

  // DOT driver-file items for Box Truck / Tractor Truck drivers.
  const dotResult = await generateDotAlerts(now, cutoff, newAlerts);

  await notifyFlaggedIssues(newAlerts);

  return { scanned: vehicles.length, expiringDocs: docs.length, created: created + dotResult.created, dotAlerts: dotResult.created };
}

// Scan Box Truck / Tractor Truck drivers for expiring or missing DOT file items
// (medical card, CDL, annual review, MVR overdue, drug & alcohol) and open a
// DOCUMENT_EXPIRY alert per driver+item. Idempotent (skips existing unresolved).
async function generateDotAlerts(now: Date, cutoff: Date, newAlerts: NewAlert[]) {
  const YEAR = 365 * 24 * 60 * 60 * 1000;
  const drivers = await prisma.driver.findMany({
    where: { vehicleType: { in: ["BOX_TRUCK", "TRACTOR_TRUCK"] } },
    select: {
      id: true, firstName: true, lastName: true,
      medicalCardExpiry: true, licenseExpiry: true, annualReviewAt: true,
      mvrCheckedAt: true, drugTestStatus: true,
      medicalCardDocUrl: true, licenseDocUrl: true, mvrDocUrl: true,
      drugTestDocUrl: true, annualReviewDocUrl: true,
    },
  });

  const items: { driverId: string; label: string; message: string; critical: boolean }[] = [];
  const dateStr = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const days = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  for (const d of drivers) {
    const who = `${d.firstName} ${d.lastName}`;
    const expiryItem = (label: string, date: Date | null) => {
      if (!date) { items.push({ driverId: d.id, label, message: `${label} missing for ${who}`, critical: true }); return; }
      if (date <= cutoff) {
        const n = days(date);
        items.push({ driverId: d.id, label, message: n < 0 ? `${label} expired ${dateStr(date)} for ${who}` : `${label} expires ${dateStr(date)} (in ${n} day${n === 1 ? "" : "s"}) for ${who}`, critical: n < 0 || n <= 7 });
      }
    };
    expiryItem("DOT medical card", d.medicalCardExpiry);
    expiryItem("CDL / license", d.licenseExpiry);
    expiryItem("Annual review", d.annualReviewAt);
    if (!d.mvrCheckedAt) items.push({ driverId: d.id, label: "MVR", message: `MVR not on file for ${who}`, critical: true });
    else if (now.getTime() - d.mvrCheckedAt.getTime() > YEAR) items.push({ driverId: d.id, label: "MVR", message: `MVR review overdue (last ${dateStr(d.mvrCheckedAt)}) for ${who}`, critical: true });
    if (d.drugTestStatus !== "PASS") items.push({ driverId: d.id, label: "Drug & alcohol", message: `Drug & alcohol status ${d.drugTestStatus ?? "missing"} for ${who}`, critical: d.drugTestStatus === "FAIL" });
    const missingDocs: [string, string | null][] = [
      ["Medical card document", d.medicalCardDocUrl],
      ["CDL / license document", d.licenseDocUrl],
      ["MVR document", d.mvrDocUrl],
      ["Drug & alcohol document", d.drugTestDocUrl],
      ["Annual review document", d.annualReviewDocUrl],
    ];
    for (const [label, url] of missingDocs) {
      if (!url) items.push({ driverId: d.id, label, message: `${label} not uploaded for ${who}`, critical: false });
    }
  }

  const existing = await prisma.alert.findMany({
    where: { type: "DOCUMENT_EXPIRY", resolvedAt: null, driverId: { not: null } },
    select: { driverId: true, message: true },
  });
  const key4 = (m: string) => m.split(" ").slice(0, 4).join(" ");
  const existingKey = new Set(existing.map((a) => `${a.driverId}|${key4(a.message)}`));

  let created = 0;
  for (const it of items) {
    const key = `${it.driverId}|${key4(it.message)}`;
    if (existingKey.has(key)) continue;
    await prisma.alert.create({
      data: {
        type: "DOCUMENT_EXPIRY",
        severity: it.critical ? "CRITICAL" : "WARNING",
        message: it.message,
        driverId: it.driverId,
      },
    });
    existingKey.add(key);
    newAlerts.push({ severity: it.critical ? "CRITICAL" : "WARNING", message: it.message });
    created++;
  }
  return { created };
}

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const result = await generateComplianceAlerts();
  return NextResponse.json(result);
}

// Cron-friendly GET (Vercel Cron sends GET requests).
export async function GET() {
  const result = await generateComplianceAlerts();
  return NextResponse.json(result);
}
