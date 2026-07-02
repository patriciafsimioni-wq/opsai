"use client";

import { createContext, useContext, useState, useCallback } from "react";
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
  CalendarClock,
  ShieldAlert,
  UserCog,
  Landmark,
  Truck as TruckLogo,
  LogOut,
  Flag,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SidebarContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });
export function useSidebar() { return useContext(SidebarContext); }
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return <SidebarContext.Provider value={{ open, toggle }}>{children}</SidebarContext.Provider>;
}

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/map", label: "Live Map", icon: Map },
    ],
  },
  {
    title: "Fleet",
    items: [
      { href: "/vehicles", label: "Vehicles", icon: Truck },
      { href: "/drivers", label: "Drivers", icon: Users },
      { href: "/fuel", label: "Fuel", icon: Fuel },
      { href: "/fareye-routes", label: "FareEye Routes", icon: Navigation },
      { href: "/offboarding", label: "Offboarding", icon: LogOut },
    ],
  },
  {
    title: "Maintenance",
    items: [
      { href: "/maintenance", label: "Work Orders", icon: Wrench },
      { href: "/maintenance-schedule", label: "PM Schedule", icon: CalendarClock },
      { href: "/dvir", label: "DVIR", icon: ClipboardCheck },
      { href: "/work-order-requests", label: "WO Requests", icon: ClipboardList },
      { href: "/log-service", label: "Log Service", icon: ClipboardCheck },
      { href: "/services", label: "Service Catalog", icon: ListChecks },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/fleet-finance", label: "Fleet Finance", icon: Landmark },
      { href: "/finance-report", label: "Finance Report", icon: DollarSign },
      { href: "/service-costs", label: "Service Costs", icon: Receipt },
      { href: "/budget-editor", label: "PM Budgets", icon: Settings2 },
    ],
  },
  {
    title: "Reports & Tools",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/uploads", label: "Smart Upload", icon: Upload },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/safety", label: "Safety", icon: ShieldAlert },
      { href: "/issues", label: "Issue Tracker", icon: Flag },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/users", label: "Users", icon: UserCog },
    ],
  },
];

export function MobileMenuButton() {
  const { toggle } = useSidebar();
  return (
    <button onClick={toggle} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
      <Menu size={22} />
    </button>
  );
}

export function Sidebar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname();
  const { open, toggle } = useSidebar();

  return (
    <>
    {/* Overlay for mobile */}
    {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={toggle} />}
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-200 lg:static lg:translate-x-0 lg:flex",
      open ? "flex translate-x-0" : "hidden -translate-x-full lg:flex lg:translate-x-0"
    )}>
      <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <TruckLogo size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight">Live Fleet AI</span>
        </div>
        <button onClick={toggle} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden">
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title || "_top"} className={section.title ? "mt-4" : ""}>
            {section.title && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={toggle}
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
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
        <p className="font-medium text-slate-600">Fleet status</p>
        <p className="mt-1">All systems operational</p>
      </div>
    </aside>
    </>
  );
}
