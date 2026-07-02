import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser, stationWhere } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "";
  const station = sp.get("station") || "";
  const assignedToMe = sp.get("mine") === "1";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (station) where.station = station;
  if (assignedToMe) where.assignedToId = auth.user.id;

  // Station-scoped users only see issues for their station(s)
  const sw = stationWhere(auth.user);
  if (sw) where.station = sw.station;

  const issues = await prisma.issue.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      assignedTo: { select: { id: true, name: true, role: true, station: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(issues);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { title, description, priority, category, station, module, referenceId, referenceData, assignedToId } = body;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const issue = await prisma.issue.create({
    data: {
      title,
      description: description || null,
      priority: priority || "MEDIUM",
      category: category || null,
      station: station || null,
      module: module || null,
      referenceId: referenceId || null,
      referenceData: referenceData || null,
      createdById: auth.user.id,
      assignedToId: assignedToId || null,
    },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json(issue, { status: 201 });
}
