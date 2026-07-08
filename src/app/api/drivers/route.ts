import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const drivers = await prisma.driver.findMany({
    orderBy: { firstName: "asc" },
    include: { vehicles: true, _count: { select: { trips: true } } },
  });
  return NextResponse.json(drivers);
}

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  licenseNumber: z.string().min(1),
  licenseClass: z.string().optional().nullable(),
  licenseExpiry: z.string().min(1),
  status: z.enum(["ACTIVE", "ON_TRIP", "OFF_DUTY", "INACTIVE"]),
  rating: z.coerce.number().min(0).max(5).optional(),
  safetyScore: z.coerce.number().min(0).max(100).optional(),
  vehicleType: z.preprocess((v) => (v === "" ? null : v), z.enum(["CARGO_VAN", "BOX_TRUCK", "TRACTOR_TRUCK"]).optional().nullable()),
  station: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const driver = await prisma.driver.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email.toLowerCase(),
      phone: d.phone || null,
      licenseNumber: d.licenseNumber,
      licenseClass: d.licenseClass || null,
      licenseExpiry: new Date(d.licenseExpiry),
      status: d.status,
      rating: d.rating ?? 4.5,
      safetyScore: d.safetyScore ?? 85,
      vehicleType: d.vehicleType ?? "CARGO_VAN",
      station: d.station || null,
      avatarColor: ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed"][
        Math.floor(Math.random() * 5)
      ],
    },
  });
  return NextResponse.json(driver, { status: 201 });
}
