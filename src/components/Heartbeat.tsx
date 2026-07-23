"use client";

import { useEffect } from "react";

// Pings the presence endpoint on mount and every 2 minutes so the Users page
// can show who is currently online / when they were last active.
export function Heartbeat() {
  useEffect(() => {
    const ping = () =>
      fetch("/api/heartbeat", { method: "POST", keepalive: true }).catch(() => {});
    ping();
    const id = setInterval(ping, 2 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
