"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, Plus, Trash2 } from "lucide-react";
import { Card, Button, Avatar, EmptyState } from "@/components/ui";
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
type UserOption = { id: string; name: string; role: string; station: string | null };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  GENERAL_MANAGER: "General Manager",
  FLEET_MANAGER: "Fleet Manager",
  STATION_MANAGER: "Station Manager",
  MECHANIC: "Mechanic",
  VENDOR: "Vendor",
  MANAGER: "Manager",
  DRIVER: "Driver",
  DATA_ENTRY: "Data Entry",
};

export function MessagesClient({
  currentUserId,
  canManage,
}: {
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const { data: threads, loading, reload } = useData<Thread[]>("/api/messages");
  const { data: users } = useData<UserOption[]>(canManage ? "/api/users" : null);

  const [active, setActive] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const activeThread = useMemo(
    () => (threads ?? []).find((t) => t.id === active) ?? null,
    [threads, active],
  );

  function otherParty(t: Thread): Person {
    return t.senderId === currentUserId ? t.recipient : t.sender;
  }
  function threadUnread(t: Thread): number {
    const all = [t, ...t.replies];
    return all.filter((m) => m.recipientId === currentUserId && !m.read).length;
  }

  async function openThread(t: Thread) {
    setActive(t.id);
    setComposing(false);
    if (threadUnread(t) > 0) {
      await apiSend(`/api/messages/${t.id}`, "PATCH", { read: true });
      reload();
      router.refresh();
    }
  }

  async function sendNew() {
    if (!recipientId || !draft.trim()) return;
    setBusy(true);
    const res = await apiSend("/api/messages", "POST", { recipientId, body: draft.trim() });
    setBusy(false);
    if (res.ok) {
      setDraft("");
      setRecipientId("");
      setComposing(false);
      reload();
    }
  }

  async function sendReply() {
    if (!activeThread || !reply.trim()) return;
    setBusy(true);
    const res = await apiSend("/api/messages", "POST", {
      parentId: activeThread.id,
      body: reply.trim(),
    });
    setBusy(false);
    if (res.ok) {
      setReply("");
      reload();
    }
  }

  async function removeThread(t: Thread) {
    if (!confirm("Delete this conversation?")) return;
    await apiSend(`/api/messages/${t.id}`, "DELETE");
    if (active === t.id) setActive(null);
    reload();
    router.refresh();
  }

  const list = threads ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* Thread list */}
      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-3">
          <span className="text-sm font-semibold">Conversations</span>
          {canManage && (
            <Button
              variant="secondary"
              onClick={() => {
                setComposing(true);
                setActive(null);
              }}
            >
              <Plus size={15} /> New
            </Button>
          )}
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState icon={<MessageSquare size={36} />} title="No messages" description="Start a conversation." />
        ) : (
          <div className="max-h-[70vh] divide-y divide-[var(--color-border)] overflow-y-auto">
            {list.map((t) => {
              const other = otherParty(t);
              const unread = threadUnread(t);
              const last = t.replies.length ? t.replies[t.replies.length - 1] : t;
              return (
                <button
                  key={t.id}
                  onClick={() => openThread(t)}
                  className={
                    "flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 " +
                    (active === t.id ? "bg-blue-50" : unread ? "bg-blue-50/40" : "")
                  }
                >
                  <Avatar name={other.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{other.name}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(last.createdAt)}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{last.body}</p>
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Detail / compose */}
      <Card className="flex min-h-[400px] flex-col overflow-hidden">
        {composing ? (
          <div className="flex flex-1 flex-col p-4">
            <h3 className="mb-3 text-sm font-semibold">New message</h3>
            <label className="mb-1 text-xs font-medium text-slate-500">To</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="mb-3 h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm"
            >
              <option value="">Select a user…</option>
              {(users ?? [])
                .filter((u) => u.id !== currentUserId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {ROLE_LABEL[u.role] ?? u.role}
                    {u.station ? ` (${u.station})` : ""}
                  </option>
                ))}
            </select>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write your message…"
              rows={6}
              className="mb-3 flex-1 rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setComposing(false)}>Cancel</Button>
              <Button onClick={sendNew} disabled={busy || !recipientId || !draft.trim()}>
                <Send size={15} /> Send
              </Button>
            </div>
          </div>
        ) : activeThread ? (
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-3">
              <div className="flex items-center gap-2">
                <Avatar name={otherParty(activeThread).name} size={32} />
                <div>
                  <p className="text-sm font-semibold">{otherParty(activeThread).name}</p>
                  <p className="text-xs text-slate-400">
                    {ROLE_LABEL[otherParty(activeThread).role] ?? otherParty(activeThread).role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeThread(activeThread)}
                title="Delete conversation"
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {[activeThread, ...activeThread.replies].map((m) => {
                const mine = m.senderId === currentUserId;
                return (
                  <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                    <div
                      className={
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm " +
                        (mine ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800")
                      }
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={"mt-1 text-[10px] " + (mine ? "text-blue-100" : "text-slate-400")}>
                        {relativeTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-end gap-2 border-t border-[var(--color-border)] p-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-white p-2.5 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
                }}
              />
              <Button onClick={sendReply} disabled={busy || !reply.trim()}>
                <Send size={15} /> Reply
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<MessageSquare size={40} />}
            title="Select a conversation"
            description={canManage ? "Pick a thread on the left or start a new message." : "Pick a thread on the left to read and reply."}
          />
        )}
      </Card>
    </div>
  );
}
