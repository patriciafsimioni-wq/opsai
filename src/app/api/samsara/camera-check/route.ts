import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { getSamsaraVehicles, extractDxNumber, isConfigured } from "@/lib/samsara";

const norm = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/\s+/g, "");

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

  // Index Samsara vehicles by every identity we can match on. VIN is the only
  // truly stable identifier (plates get reassigned between trucks, names get
  // re-typed), so it takes priority when resolving a match.
  const byVin = new Map<string, (typeof samsaraVehicles)[number]>();
  const byDx = new Map<string, (typeof samsaraVehicles)[number]>();
  const byName = new Map<string, (typeof samsaraVehicles)[number]>();
  const byPlate = new Map<string, (typeof samsaraVehicles)[number]>();
  const byId = new Map<string, (typeof samsaraVehicles)[number]>();
  for (const sv of samsaraVehicles) {
    byId.set(sv.id, sv);
    if (sv.vin) byVin.set(norm(sv.vin), sv);
    const dx = extractDxNumber(sv.name);
    if (dx) byDx.set(dx, sv);
    if (sv.name) byName.set(norm(sv.name), sv);
    if (sv.licensePlate) byPlate.set(norm(sv.licensePlate), sv);
  }

  // Get local vehicles
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, dxNumber: true, licensePlate: true, name: true, vin: true, type: true, hasSamsaraCamera: true, samsaraId: true, offboardStatus: true, lifecycleStatus: true },
  });

  // Resolve a portal vehicle to its Samsara counterpart. Priority: VIN → DX# →
  // exact name → plate. A plate match is rejected when both sides carry a VIN
  // and they differ, because that means the plate was reused on a different
  // truck (e.g. two trucks that shared "52-141UA").
  function resolve(v: (typeof vehicles)[number]): (typeof samsaraVehicles)[number] | null {
    const vin = norm(v.vin);
    if (vin) {
      const m = byVin.get(vin);
      if (m) return m;
    }
    const dx = v.dxNumber?.toUpperCase();
    if (dx) {
      const m = byDx.get(dx);
      if (m) return m;
    }
    const nm = norm(v.name);
    if (nm) {
      const m = byName.get(nm);
      if (m) return m;
    }
    const plate = norm(v.licensePlate);
    if (plate) {
      const m = byPlate.get(plate);
      if (m && !(vin && m.vin && vin !== norm(m.vin))) return m;
    }
    return null;
  }

  // Vehicles being off-boarded or already off-boarded have had their cameras
  // uninstalled on purpose, so they must never raise "no camera" alerts.
  const OFFBOARD_LIFECYCLE = new Set(["READY_DISPOSAL", "SOLD_RETURNED", "ARCHIVED"]);
  const isOffboarding = (v: { offboardStatus: string | null; lifecycleStatus: string | null }) =>
    v.offboardStatus === "IN_PROGRESS" ||
    v.offboardStatus === "COMPLETED" ||
    OFFBOARD_LIFECYCLE.has(v.lifecycleStatus ?? "");

  let updated = 0;
  let withCamera = 0;
  let withoutCamera = 0;
  const noCameraVehicles: { id: string; dxNumber: string | null; name: string; type: string }[] = [];

  for (const v of vehicles) {
    // Skip off-boarding / off-boarded vehicles entirely — no camera expected.
    if (isOffboarding(v)) continue;

    const match = resolve(v);
    // "Connected" means the matched Samsara vehicle actually has a camera
    // installed (a cameraSerial) — merely existing in Samsara isn't enough.
    const hasCamera = !!(match && match.cameraSerial);

    // Correct the stored Samsara link: point it at the matched vehicle, and
    // clear a stale link that pointed at a different truck (VIN mismatch).
    let nextSamsaraId = v.samsaraId;
    if (match) nextSamsaraId = match.id;
    else if (v.samsaraId) {
      const linked = byId.get(v.samsaraId);
      if (linked && linked.vin && v.vin && norm(linked.vin) !== norm(v.vin)) nextSamsaraId = null;
    }

    if (hasCamera) withCamera++;
    else {
      withoutCamera++;
      noCameraVehicles.push({ id: v.id, dxNumber: v.dxNumber, name: v.name, type: v.type });
    }

    if (v.hasSamsaraCamera !== hasCamera || v.samsaraId !== nextSamsaraId) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { hasSamsaraCamera: hasCamera, samsaraId: nextSamsaraId },
      });
      updated++;
    }
  }

  // Remove any stale "no camera" alerts on vehicles that are now off-boarding /
  // off-boarded (cameras were intentionally uninstalled).
  const offboardIds = vehicles.filter(isOffboarding).map((v) => v.id);
  if (offboardIds.length) {
    await prisma.alert.deleteMany({
      where: {
        type: "MAINTENANCE_DUE",
        message: { contains: "No Samsara camera" },
        vehicleId: { in: offboardIds },
      },
    });
  }

  // Create alerts for vehicles without cameras (if not already alerted).
  // Trailers never carry a Samsara camera, so they don't warrant an alert.
  const existingAlerts = await prisma.alert.findMany({
    where: { type: "MAINTENANCE_DUE", message: { contains: "No Samsara camera" } },
    select: { vehicleId: true },
  });
  const alreadyAlerted = new Set(existingAlerts.map((a) => a.vehicleId));

  let alertsCreated = 0;
  for (const v of noCameraVehicles) {
    if (v.type === "TRAILER") continue;
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
