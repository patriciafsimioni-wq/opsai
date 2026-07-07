import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const docs = await prisma.dotDocument.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(docs);
}

const schema = z.object({
  requirement: z.string().min(1),
  title: z.string().min(1),
  docUrl: z.string().min(1),
  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.message);
  const d = parsed.data;

  const doc = await prisma.dotDocument.create({
    data: {
      requirement: d.requirement,
      title: d.title,
      docUrl: d.docUrl,
      issuedAt: d.issuedAt ? new Date(d.issuedAt) : null,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      notes: d.notes || null,
    },
  });
  return NextResponse.json(doc, { status: 201 });
}
