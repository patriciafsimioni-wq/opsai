import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { haversineKm } from "@/lib/utils";

const BBOX = { minLat: 37.3, maxLat: 38.0, minLng: -122.55, maxLng: -121.8 };

// Advance the simulation one tick: move active vehicles, burn fuel, raise alerts.
export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const vehicles = await prisma.vehicle.findMany({
    where: { status: "ACTIVE" },
  });
  const fences = await prisma.geofence.findMany();

  const newAlerts: {
    type: "SPEEDING" | "GEOFENCE_ENTER";
    severity: "INFO" | "WARNING" | "CRITICAL";
    message: string;
    vehicleId: string;
  }[] = [];

  for (const v of vehicles) {
    if (v.lat == null || v.lng == null) continue;

    // adjust heading slightly and speed
    let heading = v.heading + (Math.random() - 0.5) * 40;
    const speed = Math.max(8, Math.min(95, v.speed + (Math.random() - 0.5) * 18));

    // move: distance covered in ~3s tick. speed mph -> deg
    const distKm = (speed * 1.609) * (3 / 3600);
    const rad = (heading * Math.PI) / 180;
    let lat = v.lat + (distKm / 111) * Math.cos(rad);
    let lng = v.lng + (distKm / (111 * Math.cos((v.lat * Math.PI) / 180))) * Math.sin(rad);

    // keep inside the operating area: bounce
    if (lat < BBOX.minLat || lat > BBOX.maxLat) {
      heading = 180 - heading;
      lat = Math.max(BBOX.minLat, Math.min(BBOX.maxLat, lat));
    }
    if (lng < BBOX.minLng || lng > BBOX.maxLng) {
      heading = -heading;
      lng = Math.max(BBOX.minLng, Math.min(BBOX.maxLng, lng));
    }
    heading = (heading + 360) % 360;

    // burn fuel
    const fuelLevel = Math.max(0, v.fuelLevel - Math.random() * 0.8);

    await prisma.vehicle.update({
      where: { id: v.id },
      data: { lat, lng, heading, speed, fuelLevel, lastSeen: new Date() },
    });

    // speeding alert (rare)
    if (speed > 80 && Math.random() < 0.08) {
      newAlerts.push({
        type: "SPEEDING",
        severity: "CRITICAL",
        message: `${v.name} exceeded speed limit (${Math.round(speed)} mph)`,
        vehicleId: v.id,
      });
    }

    // geofence enter (rare)
    if (Math.random() < 0.03) {
      for (const f of fences) {
        const d = haversineKm(lat, lng, f.centerLat, f.centerLng) * 1000;
        if (d < f.radiusM) {
          newAlerts.push({
            type: "GEOFENCE_ENTER",
            severity: f.type === "RESTRICTED" ? "CRITICAL" : "INFO",
            message: `${v.name} entered geofence "${f.name}"`,
            vehicleId: v.id,
          });
          break;
        }
      }
    }
  }

  if (newAlerts.length) {
    await prisma.alert.createMany({ data: newAlerts });
  }

  const positions = await prisma.vehicle.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      speed: true,
      heading: true,
      status: true,
      fuelLevel: true,
      type: true,
      make: true,
      model: true,
      assignedDriver: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ positions, newAlerts: newAlerts.length });
}
