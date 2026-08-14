import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { isConfigured, getSamsaraSafetyEvents, getSamsaraDriverSafetyScores } from "@/lib/samsara";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json({ error: "SAMSARA_API_KEY not configured" }, { status: 500 });
  }

  const sp = req.nextUrl.searchParams;
  const days = parseInt(sp.get("days") || "30", 10);

  const now = Date.now();
  const startMs = now - days * 24 * 60 * 60 * 1000;

  const events = await getSamsaraSafetyEvents(startMs, now);

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      time: e.time,
      behaviorLabel: e.behaviorLabel,
      vehicleName: e.vehicle?.name || null,
      vehicleId: e.vehicle?.id || null,
      driverName: e.driver?.name || null,
      driverId: e.driver?.id || null,
      maxG: e.maxAccelerationGForce || null,
      lat: e.location?.latitude || null,
      lng: e.location?.longitude || null,
    })),
    total: events.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json({ error: "SAMSARA_API_KEY not configured" }, { status: 500 });
  }

  // Sync safety scores to drivers
  const scores = await getSamsaraDriverSafetyScores();

  const drivers = await prisma.driver.findMany({
    select: { id: true, samsaraId: true, firstName: true, lastName: true },
  });

  const bySamsaraId = new Map(
    drivers.filter((d) => d.samsaraId).map((d) => [d.samsaraId!, d]),
  );
  const byName = new Map(
    drivers.map((d) => [`${d.firstName} ${d.lastName}`.toUpperCase(), d]),
  );

  let updated = 0;
  for (const s of scores) {
    let driver = bySamsaraId.get(s.driverId);
    if (!driver) {
      driver = byName.get(s.driverName.toUpperCase()) ?? undefined;
    }
    if (driver) {
      await prisma.driver.update({
        where: { id: driver.id },
        data: { safetyScore: s.safetyScore },
      });
      updated++;
    }
  }

  // Also create alerts for recent critical events (last 24h)
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const recentEvents = await getSamsaraSafetyEvents(oneDayAgo, now);

  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, samsaraId: true, name: true },
  });
  const vehicleBySamsaraId = new Map(
    vehicles.filter((v) => v.samsaraId).map((v) => [v.samsaraId!, v]),
  );

  let alertsCreated = 0;
  for (const evt of recentEvents) {
    if (!evt.vehicle?.id && !evt.driver?.id) continue;
    const label = evt.behaviorLabel?.toLowerCase() ?? "";
    const isCritical = label.includes("crash") || label.includes("collision") || label.includes("speed");
    if (!isCritical) continue;

    const vehicle = evt.vehicle?.id ? vehicleBySamsaraId.get(evt.vehicle.id) : null;
    const driver = evt.driver?.id ? bySamsaraId.get(evt.driver.id) : null;

    if (!vehicle) continue;

    const alertType = label.includes("speed") ? "SPEEDING" : "HARSH_DRIVING";
    const severity = label.includes("crash") ? "CRITICAL" : "WARNING";

    // Check for duplicate
    const existingAlert = await prisma.alert.findFirst({
      where: {
        vehicleId: vehicle.id,
        type: alertType,
        message: { contains: evt.id },
      },
    });
    if (existingAlert) continue;

    await prisma.alert.create({
      data: {
        vehicleId: vehicle.id,
        driverId: driver?.id || null,
        type: alertType,
        severity,
        message: `[Samsara ${evt.id}] ${evt.behaviorLabel} - ${evt.vehicle?.name || "Unknown vehicle"}${evt.driver?.name ? ` (${evt.driver.name})` : ""}`,
      },
    });
    alertsCreated++;
  }

  return NextResponse.json({
    scoresUpdated: updated,
    totalScores: scores.length,
    alertsCreated,
    recentEvents: recentEvents.length,
  });
}
