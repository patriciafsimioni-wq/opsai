import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  date: z.string().min(1).optional(),
  vendor: z.string().min(1).optional(),
  station: z.string().optional().nullable(),
  amount: z.coerce.number().min(0).optional(),
  category: z.enum(["PARTS", "SUPPLIES"]).optional(),
  description: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceUrl: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const expense = await prisma.partsExpense.update({
    where: { id },
    data: {
      date: d.date ? new Date(d.date) : undefined,
      vendor: d.vendor,
      station: d.station === undefined ? undefined : d.station || null,
      amount: d.amount,
      category: d.category,
      description: d.description === undefined ? undefined : d.description || null,
      poNumber: d.poNumber === undefined ? undefined : d.poNumber || null,
      invoiceNumber: d.invoiceNumber === undefined ? undefined : d.invoiceNumber || null,
      invoiceUrl: d.invoiceUrl === undefined ? undefined : d.invoiceUrl || null,
    },
  });
  await logActivity(auth.user, {
    action: "updated",
    entity: "Parts & Supplies",
    entityLabel: `${expense.vendor}${expense.poNumber ? ` (PO ${expense.poNumber})` : ""}`,
    station: expense.station,
  });
  return NextResponse.json(expense);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await prisma.partsExpense.findUnique({ where: { id }, select: { vendor: true, poNumber: true, station: true } });
  await prisma.partsExpense.delete({ where: { id } });
  await logActivity(auth.user, {
    action: "deleted",
    entity: "Parts & Supplies",
    entityLabel: existing ? `${existing.vendor}${existing.poNumber ? ` (PO ${existing.poNumber})` : ""}` : id,
    station: existing?.station ?? null,
  });
  return NextResponse.json({ ok: true });
}
