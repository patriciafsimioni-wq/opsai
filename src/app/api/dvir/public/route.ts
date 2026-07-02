import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/api";

const STATUS_VALUES = ["PASS", "FAIL", "NA"] as const;

const publicDvirSchema = z.object({
  vehicleId: z.string().min(1),
  driverName: z.string().min(1),
  station: z.enum(["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"]),
  odometer: z.coerce.number().min(0).optional(),
  tires: z.enum(STATUS_VALUES).default("PASS"),
  brakes: z.enum(STATUS_VALUES).default("PASS"),
  lights: z.enum(STATUS_VALUES).default("PASS"),
  mirrors: z.enum(STATUS_VALUES).default("PASS"),
  windshield: z.enum(STATUS_VALUES).default("PASS"),
  wipers: z.enum(STATUS_VALUES).default("PASS"),
  horn: z.enum(STATUS_VALUES).default("PASS"),
  seatbelts: z.enum(STATUS_VALUES).default("PASS"),
  fluids: z.enum(STATUS_VALUES).default("PASS"),
  bodyDamage: z.enum(STATUS_VALUES).default("PASS"),
  exhaust: z.enum(STATUS_VALUES).default("PASS"),
  steering: z.enum(STATUS_VALUES).default("PASS"),
  suspension: z.enum(STATUS_VALUES).default("PASS"),
  ac: z.enum(STATUS_VALUES).default("PASS"),
  notes: z.string().optional(),
  photos: z.string().optional(),
});

// Public endpoint — vehicles for a given station
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const station = searchParams.get("station");
  if (!station) return NextResponse.json([]);
  const validStations = ["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"];
  if (!validStations.includes(station)) return NextResponse.json([]);
  const vehicles = await prisma.vehicle.findMany({
    where: { station: station as "AUS" | "ACT" | "IAH" | "CLL" | "BPT" | "HRL" | "LRD" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, dxNumber: true },
  });
  return NextResponse.json(vehicles);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = publicDvirSchema.safeParse(body);
  if (!parsed.success)
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const d = parsed.data;

  const inspectionItems = [
    d.tires, d.brakes, d.lights, d.mirrors, d.windshield, d.wipers,
    d.horn, d.seatbelts, d.fluids, d.bodyDamage, d.exhaust, d.steering,
    d.suspension, d.ac,
  ];
  const hasFail = inspectionItems.includes("FAIL");
  const overallStatus = hasFail ? "FAIL" : "PASS";
  const hasAlert =
    d.windshield === "FAIL" || d.bodyDamage === "FAIL" || d.brakes === "FAIL";

  // Find or create a system "Driver" user for public submissions
  let systemUser = await prisma.user.findFirst({
    where: { email: "driver-public@livefleetai.com" },
  });
  if (!systemUser) {
    const bcrypt = await import("bcryptjs");
    systemUser = await prisma.user.create({
      data: {
        email: "driver-public@livefleetai.com",
        name: "Driver (Public DVIR)",
        passwordHash: await bcrypt.hash("no-login-driver", 10),
        role: "DRIVER",
      },
    });
  }

  const report = await prisma.dvirReport.create({
    data: {
      vehicleId: d.vehicleId,
      submittedById: systemUser.id,
      odometer: d.odometer,
      tires: d.tires,
      brakes: d.brakes,
      lights: d.lights,
      mirrors: d.mirrors,
      windshield: d.windshield,
      wipers: d.wipers,
      horn: d.horn,
      seatbelts: d.seatbelts,
      fluids: d.fluids,
      bodyDamage: d.bodyDamage,
      exhaust: d.exhaust,
      steering: d.steering,
      suspension: d.suspension,
      ac: d.ac,
      overallStatus,
      notes: d.driverName + (d.notes ? ` — ${d.notes}` : ""),
      photos: d.photos,
      hasAlert,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
