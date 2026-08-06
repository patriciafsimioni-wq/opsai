"use client";

import { useEffect } from "react";
import { openAttachment } from "@/lib/attachment";

// Globally intercept clicks on any <a> whose href is a base64 `data:` URL and
// open it via a Blob URL instead — Chrome blocks opening `data:` URLs directly
// in a new tab (blank page). Covers every attachment link in the app, current
// and future, without touching each call site.
export function DataUrlLinkFix() {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("data:")) return;
      e.preventDefault();
      openAttachment(href, anchor.getAttribute("download") || undefined);
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return null;
}
