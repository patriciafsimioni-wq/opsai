"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Send, X } from "lucide-react";
import { useData, apiSend } from "@/lib/use-data";
import { relativeTime } from "@/lib/utils";

type Person = { id: string; name: string; role: string };
type Message = {
  id: string;
  body: string;
  senderId: string;
  recipientId: string;
  read: boolean;
  parentId: string | null;
  createdAt: string;
  sender: Person;
  recipient: Person;
};
type Thread = Message & { replies: Message[] };

// Shows unread incoming messages as a prominent alert banner on the dashboard,
// with an inline reply box so the recipient can respond without leaving the page.
export function MessagesBanner({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const { data: threads, reload } = useData<Thread[]>("/api/messages");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  // Unread incoming messages (latest per thread), newest first.
  const unread = useMemo(() => {
    const out: { thread: Thread; msg: Message }[] = [];
    for (const t of threads ?? []) {
      const all = [t, ...t.replies];
      const inbound = all.filter((m) => m.recipientId === currentUserId && !m.read);
      if (inbound.length) out.push({ thread: t, msg: inbound[inbound.length - 1] });
    }
    return out.sort((a, b) => (a.msg.createdAt < b.msg.createdAt ? 1 : -1));
  }, [threads, currentUserId]);

  async function dismiss(threadId: string) {
    await apiSend(`/api/messages/${threadId}`, "PATCH", { read: true });
    reload();
    router.refresh();
  }

  async function sendReply(threadId: string) {
    if (!reply.trim()) return;
    setBusy(true);
    const res = await apiSend("/api/messages", "POST", { parentId: threadId, body: reply.trim() });
    setBusy(false);
    if (res.ok) {
      setReply("");
      setReplyFor(null);
      await apiSend(`/api/messages/${threadId}`, "PATCH", { read: true });
      reload();
      router.refresh();
    }
  }

  if (unread.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      {unread.map(({ thread, msg }) => (
        <div
          key={thread.id}
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <MessageSquare size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-900">
                New message from {msg.sender.name}
                <span className="ml-2 text-xs font-normal text-blue-500">{relativeTime(msg.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">{msg.body}</p>

              {replyFor === thread.id ? (
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    autoFocus
                    className="flex-1 resize-none rounded-lg border border-blue-200 bg-white p-2.5 text-sm"
                  />
                  <button
                    onClick={() => sendReply(thread.id)}
                    disabled={busy || !reply.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send size={15} /> Send
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => {
                      setReplyFor(thread.id);
                      setReply("");
                    }}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    Reply
                  </button>
                  <Link href="/messages" className="text-sm font-medium text-blue-700 hover:underline">
                    Open in Messages
                  </Link>
                </div>
              )}
            </div>
            <button
              onClick={() => dismiss(thread.id)}
              title="Mark as read"
              className="rounded-md p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
