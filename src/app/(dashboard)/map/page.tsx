"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui";

const MapView = dynamic(
  () => import("@/components/MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-9rem)] items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-sm text-slate-400">
        Loading map…
      </div>
    ),
  },
);

export default function MapPage() {
  return (
    <div>
      <PageHeader
        title="Live Map"
        subtitle="Real-time GPS positions, geofences, and telemetry."
      />
      <MapView />
    </div>
  );
}
