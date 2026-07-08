import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest } from "@/lib/api";
import { canManage } from "@/lib/auth";
import { sendEmail, buildMessageEmail, getAppUrl } from "@/lib/email";

const personSelect = { select: { id: true, name: true, role: true } };

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const uid = auth.user.id;

  const threads = await prisma.userMessage.findMany({
    where: { parentId: null, OR: [{ senderId: uid }, { recipientId: uid }] },
    include: {
      sender: personSelect,
      recipient: personSelect,
      replies: {
        orderBy: { createdAt: "asc" },
        include: { sender: personSelect, recipient: personSelect },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(threads);
}

const schema = z.object({
  recipientId: z.string().optional().nullable(),
  body: z.string().min(1),
  parentId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { body, parentId } = parsed.data;

  let recipientId = parsed.data.recipientId ?? null;
  let rootParentId: string | null = null;

  if (parentId) {
    const parent = await prisma.userMessage.findUnique({ where: { id: parentId } });
    if (!parent) return badRequest("Thread not found");
    if (parent.senderId !== user.id && parent.recipientId !== user.id) {
      return NextResponse.json({ error: "Not a participant in this thread" }, { status: 403 });
    }
    recipientId = parent.senderId === user.id ? parent.recipientId : parent.senderId;
    rootParentId = parent.parentId ?? parent.id;
  } else {
    // Starting a new thread is limited to managers/admins.
    if (!canManage(user.role)) {
      return NextResponse.json({ error: "Not allowed to start a conversation" }, { status: 403 });
    }
    if (!recipientId) return badRequest("Recipient is required");
  }

  if (recipientId === user.id) return badRequest("You cannot message yourself");

  const msg = await prisma.userMessage.create({
    data: { body, senderId: user.id, recipientId: recipientId!, parentId: rootParentId },
  });

  // Notify the recipient by email (non-blocking — never fail the request).
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId! },
    select: { email: true, name: true },
  });
  if (recipient?.email) {
    const email = buildMessageEmail({
      recipientName: recipient.name || "there",
      senderName: user.name || "A teammate",
      body,
      isReply: Boolean(parentId),
      appUrl: getAppUrl(),
    });
    sendEmail({ to: recipient.email, ...email }).catch(() => {});
  }

  return NextResponse.json(msg, { status: 201 });
}

// Mark all received messages as read.
export async function PATCH() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  await prisma.userMessage.updateMany({
    where: { recipientId: auth.user.id, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
