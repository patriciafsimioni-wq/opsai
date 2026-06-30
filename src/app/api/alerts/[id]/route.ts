import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest } from "@/lib/api";

const schema = z.object({
  read: z.boolean().optional(),
  resolve: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");
  const d = parsed.data;
  const alert = await prisma.alert.update({
    where: { id },
    data: {
      read: d.read,
      resolvedAt: d.resolve ? new Date() : undefined,
    },
  });
  return NextResponse.json(alert);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.alert.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
