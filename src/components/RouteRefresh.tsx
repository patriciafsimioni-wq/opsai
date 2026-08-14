"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps server-rendered pages (dashboard stat boxes, lists, etc.) in sync with
// data changed elsewhere. Next.js only recomputes a server page on navigation,
// so a tab left open — or returned to via the browser Back button (bfcache) —
// shows stale numbers until a manual reload. We re-run the server render when
// the tab regains focus or is restored from back/forward cache.
export function RouteRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);
  return null;
}
