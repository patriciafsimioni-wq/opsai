import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, stationWhere } from "@/lib/api";
import { STATIONS, SISTER_STATIONS } from "@/lib/constants";
import { BRAND, SISTER_BRAND, SISTER_BRAND_URL } from "@/lib/brand";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  destStation: z.string().min(1),
  destPortal: z.enum(["self", "sister"]).default("self"),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { ids, destStation, destPortal } = parsed.data;

  // Only allow acting on vehicles the user can see (station scoping).
  const sw = stationWhere(auth.user);
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: ids }, ...(sw ?? {}) },
  });
  if (vehicles.length === 0) {
    return NextResponse.json({ error: "No matching vehicles" }, { status: 404 });
  }

  if (destPortal === "self") {
    if (!STATIONS.includes(destStation)) {
      return NextResponse.json({ error: `Unknown station ${destStation}` }, { status: 400 });
    }
    await prisma.vehicle.updateMany({
      where: { id: { in: vehicles.map((v) => v.id) } },
      data: { station: destStation as never },
    });
    return NextResponse.json({ ok: true, moved: vehicles.length, destPortal: BRAND, destStation });
  }

  // Cross-portal full move.
  if (!SISTER_BRAND_URL || !SISTER_BRAND) {
    return NextResponse.json({ error: "Sister portal is not configured" }, { status: 501 });
  }
  if (!process.env.TRANSFER_SECRET) {
    return NextResponse.json({ error: "Transfer secret not configured on this portal" }, { status: 501 });
  }
  if (!SISTER_STATIONS.includes(destStation)) {
    return NextResponse.json({ error: `Station ${destStation} not valid on ${SISTER_BRAND}` }, { status: 400 });
  }

  const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
  const endpoint = `${SISTER_BRAND_URL.replace(/\/$/, "")}/api/vehicles/transfer/ingest`;

  const moved: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const v of vehicles) {
    const payload = {
      station: destStation,
      name: v.name,
      make: v.make,
      model: v.model,
      year: v.year,
      vin: v.vin,
      licensePlate: v.licensePlate,
      dxNumber: v.dxNumber,
      type: v.type,
      fuelType: v.fuelType,
      odometer: v.odometer,
      tankCapacity: v.tankCapacity,
      leasingCompany: v.leasingCompany,
      leaseType: v.leaseType,
      leaseTerm: v.leaseTerm,
      leaseStartDate: iso(v.leaseStartDate),
      leaseEndDate: iso(v.leaseEndDate),
      contractMileage: v.contractMileage,
      deliveredPrice: v.deliveredPrice,
      depAmtPerMonth: v.depAmtPerMonth,
      leaseChargePerMonth: v.leaseChargePerMonth,
      totalRentPerMonth: v.totalRentPerMonth,
      serviceChargePerMonth: v.serviceChargePerMonth,
      currentBookValue: v.currentBookValue,
      excessMileageRate: v.excessMileageRate,
      openEndCapCost: v.openEndCapCost,
      openEndDeprRate: v.openEndDeprRate,
      openEndNetBookValue: v.openEndNetBookValue,
      currentMarketValue: v.currentMarketValue,
      monthsLeftPayoff: v.monthsLeftPayoff,
      monthlyPayment: v.monthlyPayment,
      paidOff: v.paidOff,
      branding: v.branding,
      registrationExpiry: iso(v.registrationExpiry),
      insuranceExpiry: iso(v.insuranceExpiry),
      dotInspectionDate: iso(v.dotInspectionDate),
      dotInspectionExpiry: iso(v.dotInspectionExpiry),
      dotInspectionDocUrl: v.dotInspectionDocUrl,
      purchaseDate: iso(v.purchaseDate),
      purchasePrice: v.purchasePrice,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-transfer-secret": process.env.TRANSFER_SECRET,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        failed.push({ name: v.name, error: j?.error ?? `HTTP ${res.status}` });
        continue;
      }
      // Off-board locally only after the destination confirmed creation, so a
      // vehicle is never lost between portals.
      await prisma.vehicle.update({
        where: { id: v.id },
        data: {
          offboardStatus: "COMPLETED",
          offboardReason: `Transferred to ${SISTER_BRAND} (${destStation})`,
          offboardedDate: new Date(),
          lifecycleStatus: "SOLD_RETURNED",
          status: "OUT_OF_SERVICE",
          assignedDriverId: null,
        },
      });
      moved.push(v.name);
    } catch (e) {
      failed.push({ name: v.name, error: e instanceof Error ? e.message : "Request failed" });
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    moved: moved.length,
    failed,
    destPortal: SISTER_BRAND,
    destStation,
  });
}
