"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, X, ArrowRight, ArrowLeft } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * A lightweight, dependency-free product tour that walks a presenter through
 * the whole portal: it navigates to each page, dims the screen, spotlights the
 * relevant element (usually the sidebar link so the page behind is visible) and
 * explains what it does. "Next" advances (navigating between pages as needed).
 */

type TourStep = {
  /** Route this step lives on. The tour navigates here before showing it. */
  path: string;
  /** CSS selector to spotlight. Omit for a centered intro/outro card. */
  selector?: string;
  title: string;
  body: string;
};

const nav = (href: string) => `nav a[href='${href}']`;

const STEPS: TourStep[] = [
  {
    path: "/",
    title: `Welcome to ${BRAND}`,
    body: "This quick tour walks through every area of your fleet portal. Use Next and Back to move around — I'll take you to each page and explain what it does. You can exit any time with Skip.",
  },
  {
    path: "/",
    selector: nav("/"),
    title: "Dashboard",
    body: "Your command center. At-a-glance fleet health: total active vehicles, utilization, open alerts and work orders, the DHL plan-vs-actual per station, and who's live on Samsara right now. Every tile is clickable.",
  },
  {
    path: "/map",
    selector: nav("/map"),
    title: "Live Map",
    body: "See every vehicle's live GPS position from Samsara. Filter by one or more stations, and the map auto-zooms to your selection. Off-boarded vehicles are excluded.",
  },
  {
    path: "/vehicles",
    selector: nav("/vehicles"),
    title: "Vehicles",
    body: "Your full fleet list. Sort by any column (Vehicle, Station, Type, Status, Leasing, Odometer, Fuel), filter by station, and see whether each van's Samsara camera is connected. Click a vehicle to edit its info, station, and registration/insurance dates.",
  },
  {
    path: "/drivers",
    selector: nav("/drivers"),
    title: "Drivers",
    body: "Every driver synced from Samsara with their real safety score and station. Open a driver to see their detail and history.",
  },
  {
    path: "/fuel",
    selector: nav("/fuel"),
    title: "Fuel",
    body: "All fuel transactions — date, vehicle, driver, station, location, transaction time, volume, price/gal and total. Sort any column and log new entries.",
  },
  {
    path: "/fareye-routes",
    selector: nav("/fareye-routes"),
    title: "FareEye Routes",
    body: "Route and wave data per station and date, with capacity tags and utilization %. Upload FareEye files and the importer normalizes times and percentages automatically.",
  },
  {
    path: "/maintenance",
    selector: nav("/maintenance"),
    title: "Work Orders",
    body: "All maintenance work orders — open, scheduled, in progress and completed. Assign work to a vendor; vendors see only their own orders and mark them 'Service Done' when finished.",
  },
  {
    path: "/maintenance-schedule",
    selector: nav("/maintenance-schedule"),
    title: "PM Schedule",
    body: "Preventive-maintenance schedule per vehicle. Services show as overdue, due soon, never performed, or on track. Assign any due service to a vendor as a work order right from here.",
  },
  {
    path: "/dvir",
    selector: nav("/dvir"),
    title: "DVIR",
    body: "Driver Vehicle Inspection Reports. Review daily pre/post-trip inspections and any defects drivers flagged.",
  },
  {
    path: "/work-order-requests",
    selector: nav("/work-order-requests"),
    title: "WO Requests",
    body: "Requests for work that need your approval. Approve one and it generates a PO number and notifies the requester.",
  },
  {
    path: "/log-service",
    selector: nav("/log-service"),
    title: "Log Service",
    body: "Record a completed service — odometer, costs, PO/invoice and description. Logged services feed Service Costs and recalculate the PM schedule automatically.",
  },
  {
    path: "/finance-report",
    selector: nav("/finance-report"),
    title: "Finance Report",
    body: "Your financial overview across the fleet — revenue and cost views you can present to stakeholders.",
  },
  {
    path: "/service-costs",
    selector: nav("/service-costs"),
    title: "Service Costs",
    body: "Every logged service cost, with a Month and Year filter and a line showing the exact date range of the data on screen.",
  },
  {
    path: "/compliance",
    selector: nav("/compliance"),
    title: "Compliance Audit",
    body: "Registration & insurance status across the active fleet. Summary tiles for expired, expiring within 30 days, not set, and valid — with sortable columns. Alerts open automatically a month before expiry.",
  },
  {
    path: "/alerts",
    selector: nav("/alerts"),
    title: "Alerts",
    body: "Everything that needs attention — document expiry, maintenance and safety alerts. The badge shows unread counts in the sidebar and top bar.",
  },
  {
    path: "/uploads",
    selector: nav("/uploads"),
    title: "Smart Upload",
    body: "Drop in a spreadsheet (fuel, routes, vehicles…) and the system classifies and imports it into the right place automatically.",
  },
  {
    path: "/users",
    selector: nav("/users"),
    title: "Users",
    body: "Manage who has access and their role — managers, mechanics, vendors and drivers. Roles control exactly what each person can see and do.",
  },
  {
    path: "/",
    title: "That's the tour!",
    body: "You've seen every area of the portal. Managers can also 'View as' a role from the top bar to preview what mechanics, vendors or drivers see. Run this tour again any time from the graduation-cap button in the top bar.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const idxRef = useRef(0);

  const stop = useCallback(() => {
    setActive(false);
    setRect(null);
    try {
      sessionStorage.removeItem("guidedTourActive");
      sessionStorage.removeItem("guidedTourIdx");
    } catch {}
  }, []);

  const goto = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    idxRef.current = clamped;
    setIdx(clamped);
    try {
      sessionStorage.setItem("guidedTourIdx", String(clamped));
    } catch {}
  }, []);

  const start = useCallback(() => {
    try {
      sessionStorage.setItem("guidedTourActive", "1");
    } catch {}
    idxRef.current = 0;
    setIdx(0);
    setActive(true);
  }, []);

  // Resume across route changes + listen for the top-bar trigger.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("guidedTourActive") === "1") {
        const saved = parseInt(sessionStorage.getItem("guidedTourIdx") || "0", 10);
        idxRef.current = Number.isFinite(saved) ? saved : 0;
        setIdx(idxRef.current);
        setActive(true);
      }
    } catch {}
    const onStart = () => start();
    window.addEventListener("synctx:start-tour", onStart);
    return () => window.removeEventListener("synctx:start-tour", onStart);
  }, [start]);

  // Drive the current step: navigate if needed, then locate + spotlight target.
  useEffect(() => {
    if (!active) return;
    const step = STEPS[idx];
    if (!step) return;

    if (step.path && step.path !== pathname) {
      router.push(step.path);
      return; // effect re-runs when pathname updates
    }

    let cancelled = false;
    let tries = 0;

    const place = () => {
      if (cancelled) return;
      if (!step.selector) {
        setRect(null); // centered card
        return;
      }
      const el = document.querySelector(step.selector) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        const rr = el.getBoundingClientRect();
        setRect({ top: rr.top, left: rr.left, width: rr.width, height: rr.height });
        return;
      }
      if (tries++ < 40) {
        setTimeout(place, 60);
      } else {
        setRect(null); // give up gracefully → centered card
      }
    };
    place();

    const onMove = () => {
      if (!step.selector) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      const rr = el?.getBoundingClientRect();
      if (rr && rr.width > 0) setRect({ top: rr.top, left: rr.left, width: rr.width, height: rr.height });
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [active, idx, pathname, router]);

  if (!active || typeof document === "undefined") return null;

  const step = STEPS[idx];
  const isFirst = idx === 0;
  const isLast = idx === STEPS.length - 1;

  // Tooltip card placement.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const CARD_W = Math.min(360, vw - 32);
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: CARD_W,
    };
  } else {
    const spaceRight = vw - (rect.left + rect.width);
    const preferRight = spaceRight > CARD_W + 24;
    if (preferRight) {
      cardStyle = {
        top: Math.max(16, Math.min(rect.top, vh - 240)),
        left: rect.left + rect.width + 16,
        width: CARD_W,
      };
    } else {
      const below = rect.top + rect.height + 16;
      const placeBelow = below + 200 < vh;
      cardStyle = {
        top: placeBelow ? below : Math.max(16, rect.top - 216),
        left: Math.max(16, Math.min(rect.left, vw - CARD_W - 16)),
        width: CARD_W,
      };
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]" aria-live="polite">
      {/* Dimmer + spotlight */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.66)",
            outline: "3px solid rgb(37 99 235)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-slate-900/66" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        style={cardStyle}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            <GraduationCap size={13} /> Guided tour
          </span>
          <button
            onClick={stop}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>
        <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            Step {idx + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => goto(idx - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={stop}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Done
              </button>
            ) : (
              <button
                onClick={() => goto(idx + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {!isLast && (
          <button
            onClick={stop}
            className="mt-3 w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
