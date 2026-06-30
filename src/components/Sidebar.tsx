"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Users,
  Map,
  Navigation,
  Wrench,
  Fuel,
  Bell,
  BarChart3,
  ListChecks,
  ClipboardCheck,
  ClipboardList,
  Receipt,
  DollarSign,
  Settings2,
  Upload,
  Truck as TruckLogo,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Live Map", icon: Map },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/fareye-routes", label: "FareEye Routes", icon: Navigation },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/work-order-requests", label: "WO Requests", icon: ClipboardList },
  { href: "/log-service", label: "Log Service", icon: ClipboardCheck },
  { href: "/services", label: "Service Catalog", icon: ListChecks },
  { href: "/service-costs", label: "Service Costs", icon: Receipt },
  { href: "/finance-report", label: "Finance Report", icon: DollarSign },
  { href: "/budget-editor", label: "PM Budgets", icon: Settings2 },
  { href: "/uploads", label: "Smart Upload", icon: Upload },
  { href: "/fuel", label: "Fuel", icon: Fuel },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <TruckLogo size={18} />
        </div>
        <span className="text-lg font-bold tracking-tight">Live Fleet AI</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon size={18} />
                {item.label}
              </span>
              {item.href === "/alerts" && alertCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
        <p className="font-medium text-slate-600">Fleet status</p>
        <p className="mt-1">All systems operational</p>
      </div>
    </aside>
  );
}
