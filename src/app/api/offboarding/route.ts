import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const vehicles = await prisma.vehicle.findMany({
    where: { offboardStatus: "IN_PROGRESS" },
    select: {
      id: true,
      name: true,
      dxNumber: true,
      year: true,
      make: true,
      model: true,
      odometer: true,
      station: true,
      branding: true,
      hasSamsaraCamera: true,
      leasingCompany: true,
      leaseEndDate: true,
      monthsLeftPayoff: true,
      monthlyPayment: true,
      totalRentPerMonth: true,
      paidOff: true,
      offboardReason: true,
      offboardStatus: true,
      offboardMileage: true,
      offboardBrandingRemoved: true,
      offboardCameraRemoved: true,
      offboardPickupRequested: true,
      offboardPickupDate: true,
      offboardSoldAmount: true,
      offboardedDate: true,
      maintenance: { where: { status: "COMPLETED" }, select: { cost: true } },
      fuelLogs: { select: { totalCost: true } },
    },
    orderBy: { offboardedDate: "desc" },
  });

  // Also get completed offboards
  const completed = await prisma.vehicle.findMany({
    where: { offboardStatus: "COMPLETED" },
    select: {
      id: true,
      name: true,
      dxNumber: true,
      year: true,
      make: true,
      model: true,
      offboardReason: true,
      offboardMileage: true,
      offboardSoldAmount: true,
      offboardedDate: true,
      offboardPickupDate: true,
      station: true,
    },
    orderBy: { offboardedDate: "desc" },
  });

  return NextResponse.json({ inProgress: vehicles, completed });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, vehicleId, vehicleIds, ...data } = body;

  if (action === "start") {
    // Start offboarding for selected vehicles
    const ids = vehicleIds as string[];
    const reason = data.reason as string;
    await prisma.vehicle.updateMany({
      where: { id: { in: ids } },
      data: {
        offboardStatus: "IN_PROGRESS",
        offboardReason: reason,
        offboardedDate: new Date(),
        lifecycleStatus: "READY_DISPOSAL",
        status: "OUT_OF_SERVICE",
      },
    });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (action === "update") {
    // Update offboarding step for a vehicle
    const updateData: Record<string, unknown> = {};
    if (data.offboardMileage !== undefined) updateData.offboardMileage = data.offboardMileage;
    if (data.offboardBrandingRemoved !== undefined) updateData.offboardBrandingRemoved = data.offboardBrandingRemoved;
    if (data.offboardCameraRemoved !== undefined) updateData.offboardCameraRemoved = data.offboardCameraRemoved;
    if (data.offboardPickupRequested !== undefined) updateData.offboardPickupRequested = data.offboardPickupRequested;
    if (data.offboardPickupDate !== undefined) updateData.offboardPickupDate = data.offboardPickupDate ? new Date(data.offboardPickupDate) : null;
    if (data.offboardSoldAmount !== undefined) updateData.offboardSoldAmount = data.offboardSoldAmount;
    if (data.offboardReason !== undefined) updateData.offboardReason = data.offboardReason;

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: updateData,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        offboardStatus: "COMPLETED",
        lifecycleStatus: "SOLD_RETURNED",
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
