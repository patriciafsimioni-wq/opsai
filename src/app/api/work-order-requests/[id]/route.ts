import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

const userSelect = { id: true, name: true, email: true, role: true } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const record = await prisma.workOrderRequest.findUnique({
    where: { id },
    include: {
      vehicle: true,
      service: true,
      requestedBy: { select: userSelect },
      reviewedBy: { select: userSelect },
    },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await prisma.workOrderRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "PENDING") {
    return badRequest("This request has already been reviewed.");
  }

  const updated = await prisma.workOrderRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      reviewNote: parsed.data.reviewNote || null,
      reviewedById: auth.user.id,
      reviewedAt: new Date(),
    },
    include: {
      vehicle: true,
      service: true,
      requestedBy: { select: userSelect },
      reviewedBy: { select: userSelect },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.workOrderRequest.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
