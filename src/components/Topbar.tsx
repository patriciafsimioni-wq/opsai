"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Bell, LogOut, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui";
import type { Role } from "@prisma/client";

export function Topbar({
  user,
  alertCount,
}: {
  user: { name: string; email: string; role: Role };
  alertCount: number;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleLabel =
    user.role === "ADMIN"
      ? "Administrator"
      : user.role === "MANAGER"
        ? "Fleet Manager"
        : "Driver";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 px-5 backdrop-blur">
      <div className="flex items-center gap-2 lg:hidden">
        <span className="text-lg font-bold">Live Fleet AI</span>
      </div>
      <div className="hidden lg:block">
        <p className="text-sm text-[var(--color-muted)]">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex items-center gap-3">
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
                {roleLabel}
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
    </header>
  );
}
