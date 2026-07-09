import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MECHANIC", "VENDOR", "MANAGER", "DRIVER"]).optional(),
  station: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (d.email && d.email.toLowerCase() !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
    if (dup) return badRequest("A user with this email already exists");
  }

  const data: Record<string, unknown> = {};
  if (d.name) data.name = d.name;
  if (d.email) data.email = d.email.toLowerCase();
  if (d.password) data.passwordHash = await hashPassword(d.password);
  if (d.role) data.role = d.role;
  if (d.station !== undefined) data.station = d.station || null;

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, station: true, createdAt: true },
  });

  await logActivity(auth.user, {
    action: "updated",
    entity: "User",
    entityLabel: `${user.name} (${user.email})`,
    station: user.station,
    detail: d.password ? "Password reset" : undefined,
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // A user is referenced by several records. Optional references (work orders /
  // issues assigned to them, reviews they performed) can be safely detached so
  // the login can be removed without losing that data. Required references
  // (records they authored — WO requests, issues, comments, DVIRs) represent
  // history we must not silently destroy, so we block deletion with a clear
  // message instead of letting the DB throw an opaque foreign-key error.
  const [woRequests, issuesCreated, issueComments, dvirReports] = await Promise.all([
    prisma.workOrderRequest.count({ where: { requestedById: id } }),
    prisma.issue.count({ where: { createdById: id } }),
    prisma.issueComment.count({ where: { authorId: id } }),
    prisma.dvirReport.count({ where: { submittedById: id } }),
  ]);

  const blockers: string[] = [];
  if (woRequests) blockers.push(`${woRequests} work order request${woRequests === 1 ? "" : "s"}`);
  if (issuesCreated) blockers.push(`${issuesCreated} flagged issue${issuesCreated === 1 ? "" : "s"}`);
  if (issueComments) blockers.push(`${issueComments} issue comment${issueComments === 1 ? "" : "s"}`);
  if (dvirReports) blockers.push(`${dvirReports} DVIR report${dvirReports === 1 ? "" : "s"}`);

  if (blockers.length) {
    return NextResponse.json(
      {
        error: `Can't delete this user — they authored ${blockers.join(", ")}. Reassign or remove those records first to preserve history.`,
      },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.workOrder.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
      prisma.issue.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
      prisma.workOrderRequest.updateMany({ where: { reviewedById: id }, data: { reviewedById: null } }),
      prisma.user.delete({ where: { id } }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Users] Delete failed:", message);
    return NextResponse.json({ error: "Failed to delete user — it may still be referenced by other records." }, { status: 409 });
  }

  await logActivity(auth.user, {
    action: "deleted",
    entity: "User",
    entityLabel: `${existing.name} (${existing.email})`,
    station: existing.station,
  });

  return NextResponse.json({ ok: true });
}
