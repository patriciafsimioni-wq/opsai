import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));

  const budgets = await prisma.pmBudget.findMany({
    where: { year },
    orderBy: [{ station: "asc" }, { category: "asc" }, { month: "asc" }],
  });

  return NextResponse.json(budgets);
}

const upsertSchema = z.object({
  year: z.number().int().min(2020).max(2035),
  month: z.number().int().min(1).max(12),
  station: z.enum(["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"]),
  category: z.string().min(1),
  amount: z.number().min(0),
});

const bulkSchema = z.object({
  budgets: z.array(upsertSchema),
});

export async function POST(req: NextRequest) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const results = [];
  for (const b of parsed.data.budgets) {
    const result = await prisma.pmBudget.upsert({
      where: {
        year_month_station_category: {
          year: b.year,
          month: b.month,
          station: b.station,
          category: b.category,
        },
      },
      update: { amount: b.amount },
      create: {
        year: b.year,
        month: b.month,
        station: b.station,
        category: b.category,
        amount: b.amount,
      },
    });
    results.push(result);
  }

  return NextResponse.json({ updated: results.length });
}
