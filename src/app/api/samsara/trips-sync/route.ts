import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { getSamsaraTrips, isConfigured, SamsaraPermissionError } from "@/lib/samsara";

const DAYS_BACK = 14;

// Pulls recent trips from Samsara for every vehicle that has a linked Samsara
// device and stores them as Trip records, assigning each to the vehicle's
// currently assigned driver. Idempotent: a trip is keyed by vehicle + start
// time so re-running does not create duplicates.
export async function POST() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json({ error: "SAMSARA_API_KEY not configured" }, { status: 500 });
  }

  const now = Date.now();
  const start = now - DAYS_BACK * 24 * 60 * 60 * 1000;

  const vehicles = await prisma.vehicle.findMany({
    where: { NOT: { samsaraId: null } },
    select: { id: true, samsaraId: true, assignedDriverId: true, station: true },
  });

  if (vehicles.length === 0) {
    return NextResponse.json({ error: "No vehicles are linked to Samsara. Run Sync Samsara on the Vehicles page first." }, { status: 400 });
  }

  // Existing trips within the window, to avoid duplicates (key: vehicleId|startISO).
  const existing = await prisma.trip.findMany({
    where: { scheduledStart: { gte: new Date(start) } },
    select: { vehicleId: true, scheduledStart: true },
  });
  const existingKey = new Set(existing.map((t) => `${t.vehicleId}|${t.scheduledStart.toISOString()}`));

  let created = 0;
  let vehiclesWithTrips = 0;
  try {
    for (const v of vehicles) {
      if (!v.samsaraId) continue;
      const trips = await getSamsaraTrips(v.samsaraId, start, now);
      if (trips.length > 0) vehiclesWithTrips++;
      for (const t of trips) {
        const scheduledStart = new Date(t.startMs);
        const key = `${v.id}|${scheduledStart.toISOString()}`;
        if (existingKey.has(key)) continue;
        const ended = t.endMs ? new Date(t.endMs) : null;
        await prisma.trip.create({
          data: {
            vehicleId: v.id,
            driverId: v.assignedDriverId ?? null,
            origin: t.startLocation || "Unknown",
            destination: t.endLocation || "Unknown",
            originLat: t.startCoordinates?.latitude ?? null,
            originLng: t.startCoordinates?.longitude ?? null,
            destLat: t.endCoordinates?.latitude ?? null,
            destLng: t.endCoordinates?.longitude ?? null,
            status: ended ? "COMPLETED" : "IN_PROGRESS",
            scheduledStart,
            startedAt: scheduledStart,
            endedAt: ended,
            distanceKm: t.distanceMeters ? Math.round(t.distanceMeters * 0.000621371) : 0,
          },
        });
        existingKey.add(key);
        created++;
      }
    }
  } catch (err) {
    if (err instanceof SamsaraPermissionError) {
      return NextResponse.json(
        {
          error:
            "Your Samsara API token does not have Vehicle Trips permission. In Samsara: Settings → API Tokens → edit this token → enable the 'Vehicle Trips' (read) scope, then try again.",
          needsPermission: true,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Samsara sync failed" }, { status: 502 });
  }

  return NextResponse.json({ scannedVehicles: vehicles.length, vehiclesWithTrips, created });
}
