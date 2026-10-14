import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { findAccessibleVehicle, NOTE_MAX_LENGTH } from "@/lib/vehicle-notes";

const schema = z.object({
  body: z.string().trim().min(1, "Write a note first").max(NOTE_MAX_LENGTH),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const vehicle = await findAccessibleVehicle(auth.user, id);
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  const notes = await prisma.vehicleNote.findMany({
    where: { vehicleId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const vehicle = await findAccessibleVehicle(auth.user, id);
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const note = await prisma.vehicleNote.create({
    data: {
      vehicleId: id,
      body: parsed.data.body,
      authorId: auth.user.id,
      authorName: auth.user.name || auth.user.email,
    },
  });

  await logActivity(auth.user, {
    action: "created",
    entity: "Vehicle Note",
    entityLabel: vehicle.name,
    station: vehicle.station,
    detail: parsed.data.body.slice(0, 200),
  });

  return NextResponse.json(note, { status: 201 });
}
