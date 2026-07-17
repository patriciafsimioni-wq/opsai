import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { sendEmail, buildIssueEmail, getAppUrl } from "@/lib/email";

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

  // Private: only creator, assignee, or admins can view
  const adminRoles = ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "DATA_ENTRY"];
  if (!adminRoles.includes(auth.user.role) && issue.createdBy.id !== auth.user.id && issue.assignedTo?.id !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(issue);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const body = await req.json();
  const { status, priority, assignedToId, title, description } = body;

  const prev = await prisma.issue.findUnique({
    where: { id },
    select: { assignedToId: true, status: true, createdById: true },
  });

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
      createdBy: { select: { id: true, name: true, role: true, email: true } },
      assignedTo: { select: { id: true, name: true, role: true, email: true } },
    },
  });

  await logActivity(auth.user, {
    action: "updated",
    entity: "Issue",
    entityLabel: issue.title,
    station: issue.station,
    detail: status ? `Status: ${status}` : undefined,
  });

  const appUrl = getAppUrl();

  // Notify a newly assigned user
  if (
    issue.assignedTo?.email &&
    issue.assignedToId !== prev?.assignedToId &&
    issue.assignedToId !== auth.user.id
  ) {
    const { subject, html } = buildIssueEmail({
      recipientName: issue.assignedTo.name ?? "there",
      kind: "assigned",
      actorName: auth.user.name,
      issueTitle: issue.title,
      priority: issue.priority,
      appUrl,
    });
    await sendEmail({ to: issue.assignedTo.email, subject, html });
  }

  // Notify creator + assignee when status changes (so they can follow up to resolution)
  if (status && status !== prev?.status) {
    const recipients = [issue.createdBy, issue.assignedTo].filter(
      (u): u is NonNullable<typeof u> =>
        !!u?.email && u.id !== auth.user.id,
    );
    const seen = new Set<string>();
    for (const r of recipients) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const { subject, html } = buildIssueEmail({
        recipientName: r.name ?? "there",
        kind: "status",
        actorName: auth.user.name,
        issueTitle: issue.title,
        issueStatus: status,
        appUrl,
      });
      await sendEmail({ to: r.email!, subject, html });
    }
  }

  return NextResponse.json(issue);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const existing = await prisma.issue.findUnique({ where: { id }, select: { title: true, station: true } });
  await prisma.issue.delete({ where: { id } });
  await logActivity(auth.user, {
    action: "deleted",
    entity: "Issue",
    entityLabel: existing?.title ?? id,
    station: existing?.station ?? null,
  });
  return NextResponse.json({ ok: true });
}
