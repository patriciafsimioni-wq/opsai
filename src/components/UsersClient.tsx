"use client";

import { useState } from "react";
import { Plus, Shield, Pencil, Trash2 } from "lucide-react";
import { Card, Button, Table, Th, Td, Badge } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { apiSend } from "@/lib/use-data";
import { formatDate } from "@/lib/utils";

const ROLES = [
  { value: "GENERAL_MANAGER", label: "General Manager" },
  { value: "FLEET_MANAGER", label: "Fleet Manager" },
  { value: "STATION_MANAGER", label: "Station Manager" },
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
};

const STATIONS = ["IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT"];

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  station: string | null;
  createdAt: string | Date;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "STATION_MANAGER",
  station: "",
};

export function UsersClient({ users: initialUsers, currentRole }: { users: UserRow[]; currentRole: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    if (editingUser) {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        station: ["STATION_MANAGER", "MECHANIC", "DRIVER"].includes(form.role) ? form.station || null : null,
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
        station: ["STATION_MANAGER", "MECHANIC", "DRIVER"].includes(form.role) ? form.station || null : null,
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
    const res = await apiSend(`/api/users/${id}`, "DELETE", {});
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDeleteConfirm(null);
    }
  }

  function openEdit(u: UserRow) {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, station: u.station ?? "" });
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
          <Button onClick={() => { setEditingUser(null); setForm(emptyForm); setError(""); setModalOpen(true); }}>
            <Plus size={16} /> Add User
          </Button>
        )}
      </div>

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
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Station</Th>
              <Th>Created</Th>
              {canCreate && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <Td className="font-medium">{u.name}</Td>
                <Td className="text-slate-600">{u.email}</Td>
                <Td>
                  <Badge bg={ROLE_COLORS[u.role]?.bg ?? "#e2e8f0"} fg={ROLE_COLORS[u.role]?.fg ?? "#475569"}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                </Td>
                <Td className="text-slate-600">{u.station ?? "All"}</Td>
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
            <Field label="Assigned Station">
              <Select
                value={form.station}
                onChange={(e) => setForm({ ...form, station: e.target.value })}
                options={[{ value: "", label: "Select station…" }, ...STATIONS.map((s) => ({ value: s, label: s }))]}
              />
              <p className="mt-1 text-[10px] text-slate-400">This user will only see data for this station</p>
            </Field>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? (editingUser ? "Saving…" : "Creating…") : (editingUser ? "Save Changes" : "Create User")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
