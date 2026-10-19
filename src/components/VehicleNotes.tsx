"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, StickyNote } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export type VehicleNoteRow = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

/** Running log of free-text notes on a vehicle: add, edit and delete. */
export function VehicleNotes({ vehicleId, notes }: { vehicleId: string; notes: VehicleNoteRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify({ body }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the note");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the note");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!draft.trim()) return;
    if (await send(`/api/vehicles/${vehicleId}/notes`, "POST", draft)) setDraft("");
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    if (await send(`/api/vehicles/${vehicleId}/notes/${id}`, "PATCH", editText)) setEditingId(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    await send(`/api/vehicles/${vehicleId}/notes/${id}`, "DELETE");
  }

  return (
    <div className="p-5">
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add();
          }}
          rows={3}
          placeholder="Add a note about this vehicle…"
          className={inputCls}
        />
        <div className="flex items-center justify-between">
          {error ? <p className="text-xs text-red-600">{error}</p> : <span />}
          <button
            type="button"
            onClick={add}
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && !editingId ? "Saving…" : "Add note"}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="mt-4 flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
          <StickyNote size={14} /> No notes yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {notes.map((n) => (
            <li key={n.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{n.authorName}</span> · {formatDateTime(n.createdAt)}
                  {new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 1000 && (
                    <span className="italic"> · edited</span>
                  )}
                </p>
                {n.canEdit && editingId !== n.id && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(n.id);
                        setEditText(n.body);
                        setError(null);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Edit note"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      disabled={busy}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              {editingId === n.id ? (
                <div className="mt-2 space-y-2">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} className={inputCls} autoFocus />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                      className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(n.id)}
                      disabled={busy || !editText.trim()}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
