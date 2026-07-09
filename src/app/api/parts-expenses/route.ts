import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const where = year
    ? { date: { gte: new Date(Number(year), 0, 1), lte: new Date(Number(year), 11, 31, 23, 59, 59) } }
    : {};
  const expenses = await prisma.partsExpense.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return NextResponse.json(expenses);
}

const schema = z.object({
  date: z.string().min(1),
  vendor: z.string().min(1),
  station: z.string().optional().nullable(),
  amount: z.coerce.number().min(0),
  category: z.enum(["PARTS", "SUPPLIES"]).default("PARTS"),
  description: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceUrl: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const expense = await prisma.partsExpense.create({
    data: {
      date: new Date(d.date),
      vendor: d.vendor,
      station: d.station || null,
      amount: d.amount,
      category: d.category,
      description: d.description || null,
      poNumber: d.poNumber || null,
      invoiceNumber: d.invoiceNumber || null,
      invoiceUrl: d.invoiceUrl || null,
    },
  });
  await logActivity(auth.user, {
    action: "logged",
    entity: "Parts & Supplies",
    entityLabel: `${expense.vendor}${expense.poNumber ? ` (PO ${expense.poNumber})` : ""}`,
    station: expense.station,
    detail: `$${expense.amount.toFixed(2)}`,
  });
  return NextResponse.json(expense, { status: 201 });
}
