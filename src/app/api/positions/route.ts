import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const vehicles = await prisma.vehicle.findMany({
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
  return NextResponse.json(vehicles);
}
