"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncSamsaraButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    setMsg("");
    try {
      const res = await fetch("/api/samsara/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || "Sync failed");
      } else {
        setMsg(`Updated ${data.updated ?? 0} of ${data.samsaraVehicles ?? 0}`);
        router.refresh();
      }
    } catch {
      setMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[11px] font-medium text-blue-100">{msg}</span>}
      <button
        onClick={sync}
        disabled={syncing}
        className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/25 disabled:opacity-60"
        title="Pull the latest live vehicle data from Samsara"
      >
        <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing…" : "Sync live"}
      </button>
    </div>
  );
}
