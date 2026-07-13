"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Bell, LogOut, ChevronDown, Eye, GraduationCap, MessageSquare, KeyRound } from "lucide-react";
import { MobileMenuButton } from "@/components/Sidebar";
import { Avatar } from "@/components/ui";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { BRAND } from "@/lib/brand";
import type { Role } from "@prisma/client";

const ALL_ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Administrator" },
  { value: "GENERAL_MANAGER", label: "General Manager" },
  { value: "FLEET_MANAGER", label: "Fleet Manager" },
  { value: "STATION_MANAGER", label: "Station Manager" },
  { value: "MANAGER", label: "Manager" },
  { value: "MECHANIC", label: "Mechanic" },
  { value: "VENDOR", label: "Vendor" },
  { value: "DRIVER", label: "Driver" },
];

export function Topbar({
  user,
  alertCount,
  messageCount = 0,
  viewAsRole,
}: {
  user: { name: string; email: string; role: Role; station: string | null };
  alertCount: number;
  messageCount?: number;
  viewAsRole?: string | null;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const isAdmin = user.role === "ADMIN" || user.role === "GENERAL_MANAGER" || user.role === "FLEET_MANAGER";

  function setViewAs(role: string) {
    if (role === "" || role === user.role) {
      document.cookie = "viewAsRole=; path=/; max-age=0";
    } else {
      document.cookie = `viewAsRole=${role}; path=/; max-age=86400`;
    }
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const ROLE_MAP: Record<string, string> = {
    ADMIN: "Administrator",
    GENERAL_MANAGER: "General Manager",
    FLEET_MANAGER: "Fleet Manager",
    STATION_MANAGER: "Station Manager",
    MECHANIC: "Mechanic",
    VENDOR: "Vendor",
    MANAGER: "Manager",
    DRIVER: "Driver",
  };
  const roleLabel = ROLE_MAP[user.role] ?? user.role;
  const stationLabel = user.station ? ` — ${user.station}` : "";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 px-5 backdrop-blur">
      <div className="flex items-center gap-2 lg:hidden">
        <MobileMenuButton />
        <span className="text-lg font-bold">{BRAND}</span>
      </div>
      <div className="hidden lg:block">
        <p className="text-sm text-[var(--color-muted)]">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "America/Chicago",
          })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <Eye size={15} className={viewAsRole ? "text-amber-600" : "text-slate-400"} />
            <select
              value={viewAsRole || ""}
              onChange={(e) => setViewAs(e.target.value)}
              className={`h-8 rounded-lg border px-2 text-xs font-medium ${viewAsRole ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"}`}
            >
              <option value="">View as: My Role</option>
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={() => window.dispatchEvent(new Event("synctx:start-tour"))}
          className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:inline-flex"
          title="Take a guided tour of the portal"
        >
          <GraduationCap size={15} /> Tour
        </button>
        <Link
          href="/messages"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title="Messages"
        >
          <MessageSquare size={18} />
          {messageCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {messageCount}
            </span>
          )}
        </Link>
        <Link
          href="/alerts"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <Bell size={18} />
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {alertCount}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100"
          >
            <Avatar name={user.name} size={32} />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs leading-tight text-[var(--color-muted)]">
                {roleLabel}{stationLabel}
              </p>
            </div>
            <ChevronDown size={15} className="text-slate-400" />
          </button>
          {menu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenu(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-lg">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {user.email}
                  </p>
                </div>
                <div className="my-1 border-t border-[var(--color-border)]" />
                <button
                  onClick={() => {
                    setMenu(false);
                    setShowChangePassword(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <KeyRound size={16} /> Change password
                </button>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </header>
  );
}
