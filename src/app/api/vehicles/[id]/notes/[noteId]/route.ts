import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import type { SessionUser } from "@/lib/auth";
import { canEditNote, findAccessibleVehicle, NOTE_MAX_LENGTH } from "@/lib/vehicle-notes";

const schema = z.object({
  body: z.string().trim().min(1, "Note can't be empty").max(NOTE_MAX_LENGTH),
});

async function loadEditable(user: SessionUser, vehicleId: string, noteId: string) {
  const vehicle = await findAccessibleVehicle(user, vehicleId);
  if (!vehicle) return { error: NextResponse.json({ error: "Vehicle not found" }, { status: 404 }) };
  const note = await prisma.vehicleNote.findFirst({ where: { id: noteId, vehicleId } });
  if (!note) return { error: NextResponse.json({ error: "Note not found" }, { status: 404 }) };
  if (!canEditNote(user, note)) {
    return { error: NextResponse.json({ error: "Only the author or a manager can change this note" }, { status: 403 }) };
  }
  return { vehicle, note };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id, noteId } = await params;
  const found = await loadEditable(auth.user, id, noteId);
  if ("error" in found) return found.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const note = await prisma.vehicleNote.update({
    where: { id: noteId },
    data: { body: parsed.data.body },
  });

  await logActivity(auth.user, {
    action: "updated",
    entity: "Vehicle Note",
    entityLabel: found.vehicle.name,
    station: found.vehicle.station,
    detail: parsed.data.body.slice(0, 200),
  });

  return NextResponse.json(note);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id, noteId } = await params;
  const found = await loadEditable(auth.user, id, noteId);
  if ("error" in found) return found.error;

  await prisma.vehicleNote.delete({ where: { id: noteId } });

  await logActivity(auth.user, {
    action: "deleted",
    entity: "Vehicle Note",
    entityLabel: found.vehicle.name,
    station: found.vehicle.station,
    detail: found.note.body.slice(0, 200),
  });

  return NextResponse.json({ ok: true });
}
