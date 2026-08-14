"use client";

import { useMemo, useState } from "react";
import { Plus, Shield, Pencil, Trash2, Search, BookOpen } from "lucide-react";
import { Card, Button, Table, Th, Td, SortTh, Badge } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import { formatDate } from "@/lib/utils";
import { STATIONS } from "@/lib/constants";

const ROLES = [
  { value: "GENERAL_MANAGER", label: "General Manager" },
  { value: "FLEET_MANAGER", label: "Fleet Manager" },
  { value: "STATION_MANAGER", label: "Station Manager" },
  { value: "DATA_ENTRY", label: "Data Entry" },
  { value: "MECHANIC", label: "Mechanic" },
  { value: "VENDOR", label: "Vendor" },
  { value: "DRIVER", label: "Driver" },
];

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  ADMIN: { bg: "#fecaca", fg: "#991b1b" },
  GENERAL_MANAGER: { bg: "#e9d5ff", fg: "#6b21a8" },
  FLEET_MANAGER: { bg: "#dbeafe", fg: "#1e40af" },
  STATION_MANAGER: { bg: "#d1fae5", fg: "#065f46" },
  MECHANIC: { bg: "#fef3c7", fg: "#92400e" },
  VENDOR: { bg: "#f3e8ff", fg: "#7c2d12" },
  MANAGER: { bg: "#dbeafe", fg: "#1e40af" },
  DRIVER: { bg: "#e2e8f0", fg: "#475569" },
  DATA_ENTRY: { bg: "#ccfbf1", fg: "#115e59" },
};

const ROLE_LABELS: Record<string, string> = {
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

// A user is considered "online now" if they pinged within the last 5 minutes.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function renderLastActive(value?: string | Date | null) {
  if (!value) return <span className="text-slate-400">Never</span>;
  const t = new Date(value).getTime();
  const diff = Date.now() - t;
  const online = diff < ONLINE_WINDOW_MS;
  let label: string;
  if (online) label = "Online now";
  else if (diff < 60 * 60 * 1000) label = `${Math.max(1, Math.round(diff / 60000))} min ago`;
  else if (diff < 24 * 60 * 60 * 1000) label = `${Math.round(diff / 3600000)}h ago`;
  else label = formatDate(value);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-slate-300"}`}
      />
      <span className={online ? "font-medium text-green-700" : "text-slate-600"}>{label}</span>
    </span>
  );
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  station: string | null;
  createdAt: string | Date;
  lastActiveAt?: string | Date | null;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "STATION_MANAGER",
  station: "" as string,
  stations: [] as string[],
};

export function UsersClient({ users: initialUsers, currentRole }: { users: UserRow[]; currentRole: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sendingGuide, setSendingGuide] = useState(false);
  const [bulkGuide, setBulkGuide] = useState(false);
  const [bulkGuideResult, setBulkGuideResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const sort = useTableSort<UserRow, "name" | "email" | "role" | "station" | "created" | "active">(
    {
      name: (u) => u.name.toLowerCase(),
      email: (u) => u.email.toLowerCase(),
      role: (u) => ROLE_LABELS[u.role] ?? u.role,
      station: (u) => (u.station ?? "").toLowerCase(),
      created: (u) => new Date(u.createdAt).getTime(),
      active: (u) => (u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0),
    },
    "name",
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      return true;
    });
    return sort.sortRows(result);
  }, [users, search, roleFilter, sort]);

  function getStationValue(): string | null {
    if (!["STATION_MANAGER", "MECHANIC", "DRIVER"].includes(form.role)) return null;
    return form.stations.length > 0 ? form.stations.join(",") : null;
  }

  async function save() {
    setSaving(true);
    setError("");
    if (editingUser) {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        station: getStationValue(),
      };
      if (form.password) payload.password = form.password;
      const res = await apiSend(`/api/users/${editingUser.id}`, "PATCH", payload);
      setSaving(false);
      if (res.ok) {
        setModalOpen(false);
        setEditingUser(null);
        setForm(emptyForm);
        const d = res.data as Record<string, string | null>;
        setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, name: d.name!, email: d.email!, role: d.role!, station: d.station ?? null } : u));
      } else {
        setError(res.error ?? "Failed to update user");
      }
    } else {
      const res = await apiSend("/api/users", "POST", {
        ...form,
        station: getStationValue(),
      });
      setSaving(false);
      if (res.ok) {
        setModalOpen(false);
        setForm(emptyForm);
        const d = res.data as Record<string, string | null>;
        const newUser = { id: d.id!, email: d.email!, name: d.name!, role: d.role!, station: d.station ?? null, createdAt: new Date().toISOString() };
        setUsers((prev) => [newUser, ...prev]);
      } else {
        setError(res.error ?? "Failed to create user");
      }
    }
  }

  async function deleteUser(id: string) {
    setDeleteError("");
    const res = await apiSend(`/api/users/${id}`, "DELETE", {});
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDeleteConfirm(null);
    } else {
      setDeleteError(res.error ?? "Failed to delete user");
    }
  }

  async function resendWelcome() {
    if (!editingUser) return;
    setResending(true);
    setResendResult(null);
    const res = await apiSend(`/api/users/${editingUser.id}/resend-invite`, "POST", {});
    setResending(false);
    if (res.ok) {
      const d = res.data as { emailSent: boolean; tempPassword: string; emailError?: string | null };
      setResendResult({
        ok: d.emailSent,
        msg: d.emailSent
          ? `Welcome email sent to ${editingUser.email}. New temporary password: ${d.tempPassword}`
          : `Password reset to "${d.tempPassword}" but the email failed to send${d.emailError ? ` (${d.emailError})` : ""}. Share the password manually.`,
      });
    } else {
      setResendResult({ ok: false, msg: res.error ?? "Failed to resend welcome email" });
    }
  }

  async function sendGuide() {
    if (!editingUser) return;
    setSendingGuide(true);
    setResendResult(null);
    const res = await apiSend(`/api/users/${editingUser.id}/send-guide`, "POST", {});
    setSendingGuide(false);
    if (res.ok) {
      const d = res.data as { emailSent: boolean; emailError?: string | null };
      setResendResult({
        ok: d.emailSent,
        msg: d.emailSent
          ? `Guide email sent to ${editingUser.email}.`
          : `Failed to send the guide email${d.emailError ? ` (${d.emailError})` : ""}.`,
      });
    } else {
      setResendResult({ ok: false, msg: res.error ?? "Failed to send guide email" });
    }
  }

  async function sendGuideToEveryone() {
    setBulkGuide(true);
    setBulkGuideResult(null);
    const res = await apiSend(`/api/users/send-guide`, "POST", {});
    setBulkGuide(false);
    if (res.ok) {
      const d = res.data as { total: number; sent: number; failed: { email: string }[] };
      setBulkGuideResult({
        ok: d.failed.length === 0,
        msg: d.failed.length === 0
          ? `Guide email sent to all ${d.sent} user${d.sent === 1 ? "" : "s"}.`
          : `Sent ${d.sent} of ${d.total}. Failed: ${d.failed.map((f) => f.email).join(", ")}.`,
      });
    } else {
      setBulkGuideResult({ ok: false, msg: res.error ?? "Failed to send guide emails" });
    }
  }

  function openEdit(u: UserRow) {
    setEditingUser(u);
    setResendResult(null);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      station: u.station ?? "",
      stations: u.station ? u.station.split(",").map((s) => s.trim()).filter(Boolean) : [],
    });
    setError("");
    setModalOpen(true);
  }

  const canCreate = currentRole === "ADMIN" || currentRole === "GENERAL_MANAGER" || currentRole === "FLEET_MANAGER" || currentRole === "MANAGER";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Manage access tiers and user accounts.
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sendGuideToEveryone}
              disabled={bulkGuide}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <BookOpen size={16} /> {bulkGuide ? "Sending…" : "Send guide to everyone"}
            </button>
            <Button onClick={() => { setEditingUser(null); setForm(emptyForm); setError(""); setModalOpen(true); }}>
              <Plus size={16} /> Add User
            </Button>
          </div>
        )}
      </div>

      {bulkGuideResult && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${bulkGuideResult.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {bulkGuideResult.msg}
        </div>
      )}

      {/* Role legend */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Shield size={14} className="text-slate-400" />
        <span className="text-xs text-slate-500 mr-2">Roles:</span>
        {Object.entries(ROLE_LABELS).map(([key, label]) => (
          <Badge key={key} bg={ROLE_COLORS[key]?.bg ?? "#e2e8f0"} fg={ROLE_COLORS[key]?.fg ?? "#475569"}>
            {label}
          </Badge>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Roles</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        {deleteError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {deleteError}
          </div>
        )}
        <Table>
          <thead>
            <tr>
              <SortTh label="Name" col="name" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Email" col="email" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Role" col="role" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Last active" col="active" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              <SortTh label="Created" col="created" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
              {canCreate && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td className="font-medium">{u.name}</Td>
                <Td className="text-slate-600">{u.email}</Td>
                <Td>
                  <Badge bg={ROLE_COLORS[u.role]?.bg ?? "#e2e8f0"} fg={ROLE_COLORS[u.role]?.fg ?? "#475569"}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                </Td>
                <Td className="text-slate-600">{u.station ? u.station.split(",").join(", ") : "All"}</Td>
                <Td className="text-slate-600">{renderLastActive(u.lastActiveAt)}</Td>
                <Td className="text-slate-600">{formatDate(u.createdAt)}</Td>
                {canCreate && (
                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Edit user"
                      >
                        <Pencil size={14} />
                      </button>
                      {deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Access Permissions Reference */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Access Permissions</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-4 py-2 text-left font-medium text-slate-500">Permission</th>
                  <th className="px-4 py-2 text-center font-medium text-slate-500">Gen. Mgr</th>
                  <th className="px-4 py-2 text-center font-medium text-slate-500">Fleet Mgr</th>
                  <th className="px-4 py-2 text-center font-medium text-slate-500">Station Mgr</th>
                  <th className="px-4 py-2 text-center font-medium text-slate-500">Mechanic</th>
                  <th className="px-4 py-2 text-center font-medium text-slate-500">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[
                  ["View Dashboard & Reports", true, true, true, false, false],
                  ["View Fleet Finance (Executive)", true, true, false, false, false],
                  ["View Finance Reports", true, true, true, false, false],
                  ["Manage Vehicles & Drivers", true, true, true, true, false],
                  ["Edit Vehicle Info", true, true, true, true, false],
                  ["Offboard / Onboard Vehicles", true, true, true, false, false],
                  ["Approve WO/PO Requests", true, true, false, false, false],
                  ["Submit WO/PO Requests", true, true, true, true, true],
                  ["Log Services & Maintenance", true, true, true, true, true],
                  ["Add Invoices", true, true, true, true, true],
                  ["Submit DVIR Inspections", true, true, true, true, true],
                  ["View PM Schedule", true, true, true, true, false],
                  ["View Fuel Management", true, true, true, false, false],
                  ["Smart Upload Data", true, true, true, false, false],
                  ["View FareEye Routes", true, true, true, false, false],
                  ["View Safety Events", true, true, true, true, false],
                  ["View Live Map", true, true, true, true, false],
                  ["Manage Users", true, true, false, false, false],
                  ["Samsara Sync & Cameras", true, true, true, false, false],
                  ["View Alerts", true, true, true, true, false],
                ].map(([perm, gm, fm, sm, mech, vendor], i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-slate-700">{perm as string}</td>
                    <td className="px-4 py-2 text-center">{gm ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-center">{fm ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-center">{sm ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-center">{mech ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-center">{vendor ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingUser(null); }} title={editingUser ? "Edit User" : "Add User"}>
        <div className="space-y-4">
          <Field label="Full Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" />
          </Field>
          <Field label={editingUser ? "New Password (leave blank to keep)" : "Password"}>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingUser ? "Leave blank to keep current" : "Min 6 characters"} type="password" />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLES} />
          </Field>
          {["STATION_MANAGER", "MECHANIC", "DRIVER"].includes(form.role) && (
            <Field label="Assigned Station(s)">
              <div className="grid grid-cols-4 gap-2">
                {STATIONS.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={form.stations.includes(s)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.stations, s]
                          : form.stations.filter((x) => x !== s);
                        setForm({ ...form, stations: next });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    {s}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Select one or more stations — user will only see data for selected stations</p>
            </Field>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? (editingUser ? "Saving…" : "Creating…") : (editingUser ? "Save Changes" : "Create User")}
          </Button>
          {editingUser && (
            <div className="border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={resendWelcome}
                disabled={resending}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              >
                {resending ? "Sending…" : "Resend welcome email"}
              </button>
              <p className="mt-1 text-[10px] text-slate-400">
                Resets the password to a new temporary one and emails the login details.
              </p>
              <button
                type="button"
                onClick={sendGuide}
                disabled={sendingGuide}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {sendingGuide ? "Sending…" : "Send guide"}
              </button>
              <p className="mt-1 text-[10px] text-slate-400">
                Emails a getting-started guide with the login and guide links. Does not change the password.
              </p>
              {resendResult && (
                <p className={`mt-2 text-xs ${resendResult.ok ? "text-green-700" : "text-red-600"}`}>
                  {resendResult.msg}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
