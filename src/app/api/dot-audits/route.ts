import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const audits = await prisma.dotAudit.findMany({ orderBy: { auditDate: "desc" } });
  return NextResponse.json(audits);
}

const schema = z.object({
  auditDate: z.string().min(1),
  officerName: z.string().optional().nullable(),
  agency: z.string().optional().nullable(),
  result: z.enum(["SATISFACTORY", "CONDITIONAL", "UNSATISFACTORY", "NOT_RATED"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  docUrl: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.message);
  const d = parsed.data;

  const audit = await prisma.dotAudit.create({
    data: {
      auditDate: new Date(d.auditDate),
      officerName: d.officerName || null,
      agency: d.agency || null,
      result: d.result || null,
      notes: d.notes || null,
      docUrl: d.docUrl || null,
    },
  });
  return NextResponse.json(audit, { status: 201 });
}
