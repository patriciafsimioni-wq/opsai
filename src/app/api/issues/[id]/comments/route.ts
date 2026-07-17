import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { sendEmail, buildIssueEmail, getAppUrl } from "@/lib/email";

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

  // Notify the other party (creator + assignee) so the thread keeps flowing.
  const issue = await prisma.issue.findUnique({
    where: { id },
    select: {
      title: true,
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
  if (issue) {
    const appUrl = getAppUrl();
    const recipients = [issue.createdBy, issue.assignedTo].filter(
      (u): u is NonNullable<typeof u> => !!u?.email && u.id !== auth.user.id,
    );
    const seen = new Set<string>();
    for (const r of recipients) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const { subject, html } = buildIssueEmail({
        recipientName: r.name ?? "there",
        kind: "comment",
        actorName: auth.user.name,
        issueTitle: issue.title,
        body: comment.text,
        appUrl,
      });
      await sendEmail({ to: r.email!, subject, html });
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
