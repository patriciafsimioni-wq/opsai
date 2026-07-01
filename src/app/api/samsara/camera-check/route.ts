import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { getSamsaraVehicles, extractDxNumber, isConfigured } from "@/lib/samsara";

export async function POST() {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "SAMSARA_API_KEY not configured" },
      { status: 500 },
    );
  }

  const samsaraVehicles = await getSamsaraVehicles();

  // Build set of all Samsara vehicle identifiers (DX numbers + license plates)
  const samsaraIdentifiers = new Set<string>();
  for (const sv of samsaraVehicles) {
    const dx = extractDxNumber(sv.name);
    if (dx) samsaraIdentifiers.add(dx);
    if (sv.licensePlate) samsaraIdentifiers.add(sv.licensePlate.toUpperCase().replace(/\s+/g, ""));
    // Also add the full name as-is (some are named by plate)
    if (sv.name) samsaraIdentifiers.add(sv.name.toUpperCase().replace(/\s+/g, ""));
  }

  // Get local vehicles
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, dxNumber: true, licensePlate: true, name: true, hasSamsaraCamera: true, samsaraId: true },
  });

  let updated = 0;
  let withCamera = 0;
  let withoutCamera = 0;
  const noCameraVehicles: { id: string; dxNumber: string | null; name: string }[] = [];

  for (const v of vehicles) {
    const dx = v.dxNumber?.toUpperCase();
    const plate = v.licensePlate?.toUpperCase().replace(/\s+/g, "");

    // Vehicle is in Samsara if matched by DX, plate, or already has samsaraId
    const hasCamera = !!(
      v.samsaraId ||
      (dx && samsaraIdentifiers.has(dx)) ||
      (plate && samsaraIdentifiers.has(plate))
    );

    if (hasCamera) withCamera++;
    else {
      withoutCamera++;
      noCameraVehicles.push({ id: v.id, dxNumber: v.dxNumber, name: v.name });
    }

    if (v.hasSamsaraCamera !== hasCamera) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { hasSamsaraCamera: hasCamera },
      });
      updated++;
    }
  }

  // Create alerts for vehicles without cameras (if not already alerted)
  const existingAlerts = await prisma.alert.findMany({
    where: { type: "MAINTENANCE_DUE", message: { contains: "No Samsara camera" } },
    select: { vehicleId: true },
  });
  const alreadyAlerted = new Set(existingAlerts.map((a) => a.vehicleId));

  let alertsCreated = 0;
  for (const v of noCameraVehicles) {
    if (alreadyAlerted.has(v.id)) continue;
    await prisma.alert.create({
      data: {
        type: "MAINTENANCE_DUE",
        severity: "WARNING",
        message: `No Samsara camera connected — ${v.dxNumber || v.name}`,
        vehicleId: v.id,
      },
    });
    alertsCreated++;
  }

  return NextResponse.json({
    total: vehicles.length,
    withCamera,
    withoutCamera,
    updated,
    alertsCreated,
    noCameraVehicles: noCameraVehicles.map((v) => v.dxNumber || v.name),
  });
}
