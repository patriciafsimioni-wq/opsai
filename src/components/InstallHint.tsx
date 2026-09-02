"use client";

import { useSyncExternalStore } from "react";
import { Share, X } from "lucide-react";
import { BRAND } from "@/lib/brand";

const DISMISSED_KEY = "installHintDismissed";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function shouldShow() {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac, so touch support is the giveaway.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && !isStandalone && localStorage.getItem(DISMISSED_KEY) !== "1";
}

function dismiss() {
  localStorage.setItem(DISMISSED_KEY, "1");
  listeners.forEach((l) => l());
}

/** Tells iPad/iPhone users how to install the portal as an app. Safari has no
 *  install prompt API, so the Share → Add to Home Screen steps must be spelled
 *  out; hidden once the app is already running from the home screen. */
export function InstallHint() {
  const show = useSyncExternalStore(subscribe, shouldShow, () => false);
  if (!show) return null;

  return (
    <div className="relative rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <button
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
      >
        <X size={16} />
      </button>
      <p className="pr-6 font-semibold">Install {BRAND} on this device</p>
      <p className="mt-1 flex flex-wrap items-center gap-1 pr-6 text-blue-800">
        Tap <Share size={15} className="inline" /> Share, then
        <span className="font-medium">Add to Home Screen</span> — it opens
        full-screen like an app.
      </p>
    </div>
  );
}
