import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";

// Mark a single received message (or thread root) as read.
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  await prisma.userMessage.updateMany({
    where: { id, recipientId: auth.user.id },
    data: { read: true },
  });
  // Also mark replies in the thread addressed to this user as read.
  await prisma.userMessage.updateMany({
    where: { parentId: id, recipientId: auth.user.id, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const msg = await prisma.userMessage.findUnique({ where: { id } });
  if (!msg) return NextResponse.json({ ok: true });
  if (msg.senderId !== auth.user.id && msg.recipientId !== auth.user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  await prisma.userMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
