import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";

const patchSchema = z.object({
  auditDate: z.string().min(1).optional(),
  officerName: z.string().optional().nullable(),
  agency: z.string().optional().nullable(),
  result: z.enum(["SATISFACTORY", "CONDITIONAL", "UNSATISFACTORY", "NOT_RATED", ""]).optional().nullable(),
  notes: z.string().optional().nullable(),
  docUrl: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.auditDate !== undefined) data.auditDate = new Date(d.auditDate);
  if (d.officerName !== undefined) data.officerName = d.officerName || null;
  if (d.agency !== undefined) data.agency = d.agency || null;
  if (d.result !== undefined) data.result = d.result || null;
  if (d.notes !== undefined) data.notes = d.notes || null;
  if (d.docUrl !== undefined) data.docUrl = d.docUrl || null;

  const audit = await prisma.dotAudit.update({ where: { id }, data });
  return NextResponse.json(audit);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.dotAudit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
