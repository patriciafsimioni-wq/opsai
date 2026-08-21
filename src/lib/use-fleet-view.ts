"use client";

import { useEffect, useState } from "react";

// Global fleet view toggle (Sync Fleet only). Stored in a cookie so the choice
// persists across pages/reloads, and broadcast via a window event so every
// mounted client page re-filters immediately when it changes.
export type FleetView = "REGULAR" | "TRACTOR_TRAILER" | "ALL";

const COOKIE = "fleetView";
const EVENT = "fleetview:change";

export function readFleetView(): FleetView {
  if (typeof document === "undefined") return "REGULAR";
  const m = document.cookie.match(/(?:^|;\s*)fleetView=([^;]+)/);
  const v = m?.[1];
  return v === "TRACTOR_TRAILER" || v === "ALL" ? v : "REGULAR";
}

export function setFleetView(v: FleetView) {
  document.cookie = `${COOKIE}=${v}; path=/; max-age=${60 * 60 * 24 * 365}`;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
}

export function useFleetView(): FleetView {
  const [view, setView] = useState<FleetView>("REGULAR");
  useEffect(() => {
    setView(readFleetView());
    const handler = () => setView(readFleetView());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return view;
}

// Whether a vehicle (by its fleetGroup) is visible under the current view.
export function matchesFleetView(
  fleetGroup: string | null | undefined,
  view: FleetView,
): boolean {
  if (view === "ALL") return true;
  const g = fleetGroup === "TRACTOR_TRAILER" ? "TRACTOR_TRAILER" : "REGULAR";
  return g === view;
}
