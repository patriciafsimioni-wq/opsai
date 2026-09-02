import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { STATIONS } from "@/lib/constants";

// Server-to-server endpoint that receives a vehicle being transferred from the
// sister portal (SYNCTX <-> TROVA). Authenticated with a shared secret rather
// than a user session, because the caller is the other deployment's server.
const num = z.number().nullable().optional();
const str = z.string().nullable().optional();
const date = z.string().nullable().optional();

const schema = z.object({
  station: z.string(),
  name: z.string().min(1),
  make: z.string().default("—"),
  model: z.string().default("—"),
  year: z.number().int(),
  vin: z.string().min(1),
  licensePlate: z.string().default(""),
  dxNumber: str,
  type: z.string().default("VAN"),
  fuelType: z.string().default("GASOLINE"),
  odometer: z.number().default(0),
  tankCapacity: z.number().default(200),
  leasingCompany: str,
  leaseType: str,
  leaseTerm: num,
  leaseStartDate: date,
  leaseEndDate: date,
  contractMileage: num,
  deliveredPrice: num,
  depAmtPerMonth: num,
  leaseChargePerMonth: num,
  totalRentPerMonth: num,
  serviceChargePerMonth: num,
  currentBookValue: num,
  excessMileageRate: num,
  openEndCapCost: num,
  openEndDeprRate: num,
  openEndNetBookValue: num,
  currentMarketValue: num,
  monthsLeftPayoff: num,
  monthlyPayment: num,
  paidOff: z.boolean().optional(),
  branding: str,
  registrationExpiry: date,
  insuranceExpiry: date,
  dotInspectionDate: date,
  dotInspectionExpiry: date,
  dotInspectionDocUrl: str,
  purchaseDate: date,
  purchasePrice: num,
});

const D = (s: string | null | undefined) => (s ? new Date(s) : null);

export async function POST(req: Request) {
  const secret = process.env.TRANSFER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Transfer not configured on this portal" }, { status: 501 });
  }
  if (req.headers.get("x-transfer-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }
  const d = parsed.data;

  if (!STATIONS.includes(d.station)) {
    return NextResponse.json({ error: `Station ${d.station} not valid on this portal` }, { status: 400 });
  }

  const data = {
    name: d.name,
    make: d.make,
    model: d.model,
    year: d.year,
    licensePlate: d.licensePlate,
    dxNumber: d.dxNumber ?? null,
    type: d.type as never,
    status: "ACTIVE" as never,
    fuelType: d.fuelType as never,
    station: d.station as never,
    odometer: d.odometer,
    tankCapacity: d.tankCapacity,
    lifecycleStatus: "ACTIVE",
    leasingCompany: d.leasingCompany ?? null,
    leaseType: d.leaseType ?? null,
    leaseTerm: d.leaseTerm ?? null,
    leaseStartDate: D(d.leaseStartDate),
    leaseEndDate: D(d.leaseEndDate),
    contractMileage: d.contractMileage ?? null,
    deliveredPrice: d.deliveredPrice ?? null,
    depAmtPerMonth: d.depAmtPerMonth ?? null,
    leaseChargePerMonth: d.leaseChargePerMonth ?? null,
    totalRentPerMonth: d.totalRentPerMonth ?? null,
    serviceChargePerMonth: d.serviceChargePerMonth ?? null,
    currentBookValue: d.currentBookValue ?? null,
    excessMileageRate: d.excessMileageRate ?? null,
    openEndCapCost: d.openEndCapCost ?? null,
    openEndDeprRate: d.openEndDeprRate ?? null,
    openEndNetBookValue: d.openEndNetBookValue ?? null,
    currentMarketValue: d.currentMarketValue ?? null,
    monthsLeftPayoff: d.monthsLeftPayoff ?? null,
    monthlyPayment: d.monthlyPayment ?? null,
    paidOff: d.paidOff ?? false,
    branding: d.branding ?? null,
    registrationExpiry: D(d.registrationExpiry),
    insuranceExpiry: D(d.insuranceExpiry),
    dotInspectionDate: D(d.dotInspectionDate),
    dotInspectionExpiry: D(d.dotInspectionExpiry),
    dotInspectionDocUrl: d.dotInspectionDocUrl ?? null,
    purchaseDate: D(d.purchaseDate),
    purchasePrice: d.purchasePrice ?? null,
    lastSeen: new Date(),
  };

  // Upsert on VIN so a re-run of a transfer doesn't create duplicates and a
  // previously-transferred (then returned) vehicle is revived cleanly.
  const existing = await prisma.vehicle.findUnique({ where: { vin: d.vin } });
  const vehicle = existing
    ? await prisma.vehicle.update({
        where: { vin: d.vin },
        data: {
          ...data,
          offboardStatus: null,
          offboardReason: null,
          offboardedDate: null,
        },
      })
    : await prisma.vehicle.create({ data: { ...data, vin: d.vin } });

  return NextResponse.json({ ok: true, id: vehicle.id }, { status: 201 });
}
