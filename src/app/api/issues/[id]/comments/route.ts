import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const body = await req.json();
  const { text } = body;
  if (!text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });

  const comment = await prisma.issueComment.create({
    data: {
      issueId: id,
      authorId: auth.user.id,
      text: text.trim(),
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
