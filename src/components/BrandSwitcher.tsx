"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { BRAND, SISTER_BRAND, SISTER_BRAND_URL } from "@/lib/brand";

// Only these roles may switch between the sister portals (Sync ↔ Trova).
const SWITCH_ROLES = ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER"];

export function BrandSwitcher({ userRole }: { userRole?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canSwitch = !!userRole && SWITCH_ROLES.includes(userRole);
  const hasSister = Boolean(SISTER_BRAND && SISTER_BRAND_URL) && canSwitch;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!hasSister) {
    return <span className="text-lg font-bold tracking-tight">{BRAND}</span>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg px-1 py-0.5 text-lg font-bold tracking-tight hover:bg-slate-100"
      >
        {BRAND}
        <ChevronDown size={16} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-blue-600">
            {BRAND}
            <span className="text-xs font-normal text-slate-400">current</span>
          </div>
          <a
            href={SISTER_BRAND_URL}
            className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {SISTER_BRAND}
          </a>
        </div>
      )}
    </div>
  );
}
