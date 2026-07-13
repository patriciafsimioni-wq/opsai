"use client";

import { createContext, useContext, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Car,
  Users,
  Map,
  Navigation,
  Wrench,
  Fuel,
  Bell,
  BarChart3,
  ShieldCheck,
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
  Package,
  Truck as TruckLogo,
  LogOut,
  Flag,
  History,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwitcher } from "@/components/BrandSwitcher";

const SidebarContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });
export function useSidebar() { return useContext(SidebarContext); }
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return <SidebarContext.Provider value={{ open, toggle }}>{children}</SidebarContext.Provider>;
}

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles?: string[] };
type NavSection = { title: string; items: NavItem[]; roles?: string[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/messages", label: "Messages", icon: MessageSquare },
      { href: "/map", label: "Live Map", icon: Map },
    ],
  },
  {
    title: "Fleet",
    items: [
      { href: "/vehicles", label: "Vehicles", icon: Truck },
      { href: "/rental-vehicles", label: "Rental Vehicles", icon: Car, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
      { href: "/drivers", label: "Drivers", icon: Users, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
      { href: "/dot-compliance", label: "DOT Compliance", icon: ShieldCheck, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
      { href: "/fuel", label: "Fuel", icon: Fuel, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
      { href: "/fareye-routes", label: "FareEye Routes", icon: Navigation, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
      { href: "/offboarding", label: "Offboarding", icon: LogOut, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"] },
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
    roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"],
    items: [
      { href: "/fleet-finance", label: "Fleet Finance", icon: Landmark, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"] },
      { href: "/finance-report", label: "Finance Report", icon: DollarSign },
      { href: "/service-costs", label: "Service Costs", icon: Receipt },
      { href: "/parts-supplies", label: "Parts & Supplies", icon: Package },
      { href: "/budget-editor", label: "PM Budgets", icon: Settings2, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"] },
    ],
  },
  {
    title: "Reports & Tools",
    roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER", "MECHANIC", "VENDOR"],
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER", "MECHANIC"] },
      { href: "/uploads", label: "Smart Upload", icon: Upload, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
      { href: "/alerts", label: "Alerts", icon: Bell, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER", "MECHANIC"] },
      { href: "/safety", label: "Safety", icon: ShieldAlert, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER", "MECHANIC"] },
      { href: "/compliance", label: "Compliance Audit", icon: ShieldCheck, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
      { href: "/issues", label: "Issue Tracker", icon: Flag },
      { href: "/activity", label: "Activity Log", icon: History, roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER"] },
    ],
  },
  {
    title: "Admin",
    roles: ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"],
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

export function Sidebar({ alertCount, messageCount, userRole }: { alertCount: number; messageCount?: number; userRole?: string }) {
  const pathname = usePathname();
  const { open, toggle } = useSidebar();
  const role = userRole ?? "ADMIN";

  const visibleSections = NAV_SECTIONS
    .filter((section) => !section.roles || section.roles.includes(role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

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
          <BrandSwitcher userRole={role} />
        </div>
        <button onClick={toggle} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden">
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {visibleSections.map((section) => (
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
                    {item.href === "/messages" && (messageCount ?? 0) > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {messageCount}
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
