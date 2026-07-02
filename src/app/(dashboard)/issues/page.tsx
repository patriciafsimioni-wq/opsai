"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, Badge, EmptyState, Button } from "@/components/ui";
import { Flag, MessageCircle, Plus, ChevronRight, User, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2, Send } from "lucide-react";
import { useData, apiSend } from "@/lib/use-data";
import { formatDate } from "@/lib/utils";
import { STATION_LABEL } from "@/lib/constants";

type UserRef = { id: string; name: string; role: string; station?: string };

type Issue = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category: string | null;
  station: string | null;
  module: string | null;
  referenceId: string | null;
  referenceData: string | null;
  createdBy: UserRef;
  assignedTo: UserRef | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { comments: number };
};

type IssueDetail = Issue & {
  comments: { id: string; text: string; author: UserRef; createdAt: string }[];
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: "bg-red-50", text: "text-red-700", label: "Open" },
  IN_PROGRESS: { bg: "bg-yellow-50", text: "text-yellow-700", label: "In Progress" },
  RESOLVED: { bg: "bg-green-50", text: "text-green-700", label: "Resolved" },
  CLOSED: { bg: "bg-slate-100", text: "text-slate-500", label: "Closed" },
};

const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  LOW: { bg: "bg-slate-50", text: "text-slate-600", label: "Low" },
  MEDIUM: { bg: "bg-blue-50", text: "text-blue-700", label: "Medium" },
  HIGH: { bg: "bg-orange-50", text: "text-orange-700", label: "High" },
  URGENT: { bg: "bg-red-50", text: "text-red-700", label: "Urgent" },
};

export default function IssuesPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [prefill, setPrefill] = useState<Record<string, string>>({});

  // Handle URL params for auto-create from Flag buttons
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      const p: Record<string, string> = {};
      if (searchParams.get("title")) p.title = searchParams.get("title")!;
      if (searchParams.get("description")) p.description = searchParams.get("description")!;
      if (searchParams.get("category")) p.category = searchParams.get("category")!;
      if (searchParams.get("station")) p.station = searchParams.get("station")!;
      setPrefill(p);
      setShowCreate(true);
      // Clean URL
      window.history.replaceState({}, "", "/issues");
    }
  }, [searchParams]);

  const apiUrl = `/api/issues?${statusFilter ? `status=${statusFilter}&` : ""}${stationFilter ? `station=${stationFilter}&` : ""}`;
  const { data: issues, loading, reload: refresh } = useData<Issue[]>(apiUrl);

  const counts = {
    all: issues?.length ?? 0,
    open: issues?.filter((i) => i.status === "OPEN").length ?? 0,
    inProgress: issues?.filter((i) => i.status === "IN_PROGRESS").length ?? 0,
    resolved: issues?.filter((i) => i.status === "RESOLVED" || i.status === "CLOSED").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <CardHeader
        title="Issue Tracker"
        subtitle="Flag issues, assign tasks, and track resolution"
        action={
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Issue
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button onClick={() => setStatusFilter("")} className={`rounded-xl border p-4 text-left transition-colors ${!statusFilter ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
          <p className="text-xs font-medium text-slate-500">All Issues</p>
          <p className="text-2xl font-bold text-slate-900">{counts.all}</p>
        </button>
        <button onClick={() => setStatusFilter("OPEN")} className={`rounded-xl border p-4 text-left transition-colors ${statusFilter === "OPEN" ? "border-red-300 bg-red-50" : "border-slate-200 hover:bg-slate-50"}`}>
          <p className="text-xs font-medium text-red-600">Open</p>
          <p className="text-2xl font-bold text-red-700">{counts.open}</p>
        </button>
        <button onClick={() => setStatusFilter("IN_PROGRESS")} className={`rounded-xl border p-4 text-left transition-colors ${statusFilter === "IN_PROGRESS" ? "border-yellow-300 bg-yellow-50" : "border-slate-200 hover:bg-slate-50"}`}>
          <p className="text-xs font-medium text-yellow-600">In Progress</p>
          <p className="text-2xl font-bold text-yellow-700">{counts.inProgress}</p>
        </button>
        <button onClick={() => setStatusFilter("RESOLVED")} className={`rounded-xl border p-4 text-left transition-colors ${statusFilter === "RESOLVED" ? "border-green-300 bg-green-50" : "border-slate-200 hover:bg-slate-50"}`}>
          <p className="text-xs font-medium text-green-600">Resolved</p>
          <p className="text-2xl font-bold text-green-700">{counts.resolved}</p>
        </button>
      </div>

      {/* Station filter */}
      <div className="flex items-center gap-2">
        <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">All stations</option>
          {Object.entries(STATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : !issues?.length ? (
        <EmptyState icon={<Flag size={40} />} title="No issues" description={statusFilter ? "No issues with this status" : "No issues yet — flag one from any page"} />
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setSelectedId(issue.id)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[issue.status].bg} ${STATUS_STYLE[issue.status].text}`}>
                      {STATUS_STYLE[issue.status].label}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[issue.priority].bg} ${PRIORITY_STYLE[issue.priority].text}`}>
                      {PRIORITY_STYLE[issue.priority].label}
                    </span>
                    {issue.station && <Badge bg="bg-slate-100" fg="text-slate-600">{issue.station}</Badge>}
                    {issue.module && <span className="text-xs text-slate-400">{issue.module}</span>}
                  </div>
                  <h3 className="font-semibold text-slate-900 truncate">{issue.title}</h3>
                  {issue.description && <p className="text-sm text-slate-500 truncate mt-0.5">{issue.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><User size={12} /> {issue.createdBy.name}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(issue.createdAt)}</span>
                    {issue._count.comments > 0 && <span className="flex items-center gap-1"><MessageCircle size={12} /> {issue._count.comments}</span>}
                    {issue.assignedTo && <span className="flex items-center gap-1 text-blue-500">→ {issue.assignedTo.name}</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 mt-1 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && <CreateIssueModal prefill={prefill} onClose={() => { setShowCreate(false); setPrefill({}); }} onCreated={() => { setShowCreate(false); setPrefill({}); refresh(); }} />}
      {selectedId && <IssueDetailPanel issueId={selectedId} onClose={() => setSelectedId(null)} onUpdate={refresh} />}
    </div>
  );
}

/* ─── Create Issue Modal ─── */
function CreateIssueModal({ prefill, onClose, onCreated }: { prefill?: Record<string, string>; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(prefill?.title || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [priority, setPriority] = useState("MEDIUM");
  const [station, setStation] = useState(prefill?.station || "");
  const [category, setCategory] = useState(prefill?.category || "");
  const [assignedToId, setAssignedToId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: users } = useData<{ id: string; name: string; role: string; station: string | null }[]>("/api/users");

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const res = await apiSend("/api/issues", "POST", { title, description, priority, station: station || null, category: category || null, assignedToId: assignedToId || null });
    setSaving(false);
    if (res.ok) onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Flag New Issue</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fuel duplicates at AUS station" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Provide details about the issue..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Station</label>
              <select value={station} onChange={(e) => setStation(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Select —</option>
                {Object.entries(STATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Select —</option>
                <option value="Fuel">Fuel</option>
                <option value="Maintenance">Maintenance</option>
                <option value="DVIR">DVIR</option>
                <option value="Safety">Safety</option>
                <option value="Operations">Operations</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign to</label>
              <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Unassigned —</option>
                {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role.replace("_", " ")})</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving || !title.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Create Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Issue Detail Panel ─── */
function IssueDetailPanel({ issueId, onClose, onUpdate }: { issueId: string; onClose: () => void; onUpdate: () => void }) {
  const { data: issue, loading, reload: refresh } = useData<IssueDetail>(`/api/issues/${issueId}`);
  const { data: users } = useData<{ id: string; name: string; role: string }[]>("/api/users");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const updateStatus = useCallback(async (status: string) => {
    await apiSend(`/api/issues/${issueId}`, "PATCH", { status });
    refresh();
    onUpdate();
  }, [issueId, refresh, onUpdate]);

  const updateAssignee = useCallback(async (assignedToId: string) => {
    await apiSend(`/api/issues/${issueId}`, "PATCH", { assignedToId: assignedToId || null });
    refresh();
    onUpdate();
  }, [issueId, refresh, onUpdate]);

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    await apiSend(`/api/issues/${issueId}/comments`, "POST", { text: comment });
    setComment("");
    setSending(false);
    refresh();
    onUpdate();
  };

  if (loading || !issue) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="rounded-2xl bg-white p-12"><Loader2 size={32} className="animate-spin text-blue-600" /></div>
      </div>
    );
  }

  const ss = STATUS_STYLE[issue.status];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ss.bg} ${ss.text}`}>{ss.label}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[issue.priority].bg} ${PRIORITY_STYLE[issue.priority].text}`}>{PRIORITY_STYLE[issue.priority].label}</span>
                {issue.station && <Badge bg="bg-slate-100" fg="text-slate-600">{issue.station}</Badge>}
              </div>
              <h2 className="text-lg font-bold text-slate-900">{issue.title}</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
              <XCircle size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Description */}
          {issue.description && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{issue.description}</p>
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1"><User size={14} /> Created by {issue.createdBy.name}</span>
            <span className="flex items-center gap-1"><Clock size={14} /> {formatDate(issue.createdAt)}</span>
            {issue.category && <span>Category: {issue.category}</span>}
            {issue.module && <span>Module: {issue.module}</span>}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={issue.status}
                onChange={(e) => updateStatus(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Assigned to</label>
              <select
                value={issue.assignedTo?.id ?? ""}
                onChange={(e) => updateAssignee(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              >
                <option value="">Unassigned</option>
                {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <MessageCircle size={16} /> Comments ({issue.comments.length})
            </h3>

            {issue.comments.length > 0 && (
              <div className="space-y-3 mb-4">
                {issue.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-800">{c.author.name}</span>
                      <span className="text-xs text-slate-400">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            <div className="flex items-end gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              />
              <button
                onClick={sendComment}
                disabled={sending || !comment.trim()}
                className="rounded-lg bg-blue-600 p-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
