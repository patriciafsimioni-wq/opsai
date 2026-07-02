import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      assignedTo: { select: { id: true, name: true, role: true, station: true } },
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(issue);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const body = await req.json();
  const { status, priority, assignedToId, title, description } = body;

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === "RESOLVED" || status === "CLOSED") data.resolvedAt = new Date();
  }
  if (priority) data.priority = priority;
  if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
  if (title) data.title = title;
  if (description !== undefined) data.description = description;

  const issue = await prisma.issue.update({
    where: { id },
    data,
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json(issue);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  await prisma.issue.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
