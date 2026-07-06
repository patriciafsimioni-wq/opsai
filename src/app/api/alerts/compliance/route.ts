import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";

const DAYS_AHEAD = 30;

// Scan vehicles for registration/insurance documents expiring within DAYS_AHEAD
// days and open a DOCUMENT_EXPIRY alert for each (skipping duplicates that are
// still unresolved). Designed to be safe to run repeatedly (idempotent).
async function generateComplianceAlerts() {
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
    created++;
  }

  return { scanned: vehicles.length, expiringDocs: docs.length, created };
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
