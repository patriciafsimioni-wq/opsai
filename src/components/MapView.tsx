"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Truck, Pause, Play, Search, RefreshCw } from "lucide-react";
import type { PositionDTO } from "@/lib/types";
import { VEHICLE_STATUS } from "@/lib/constants";

function statusColor(status: string) {
  return (
    VEHICLE_STATUS[status as keyof typeof VEHICLE_STATUS]?.color ?? "#64748b"
  );
}

function createIcon(p: PositionDTO) {
  const color = statusColor(p.status);
  const moving = p.status === "ACTIVE";
  const html = `
    <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
      ${moving ? `<span style="position:absolute;width:30px;height:30px;border-radius:50%;background:${color};opacity:.35;animation:pulse-ring 1.6s ease-out infinite;"></span>` : ""}
      <span style="position:relative;width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;transform:rotate(${p.heading}deg);">
        <span style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid #fff;margin-top:-2px;"></span>
      </span>
    </div>`;
  return L.divIcon({ html, className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
}

function popupHtml(p: PositionDTO) {
  const driver = p.assignedDriver
    ? `${p.assignedDriver.firstName} ${p.assignedDriver.lastName}`
    : "Unassigned";
  return `
    <div style="font-size:12px;min-width:160px;">
      <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${p.name}</div>
      <div style="color:#64748b;margin-bottom:6px;">${p.make} ${p.model}</div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Speed</span><b>${Math.round(p.speed)} mph</b></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Fuel</span><b>${Math.round(p.fuelLevel)}%</b></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Driver</span><b>${driver}</b></div>
    </div>`;
}

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [positions, setPositions] = useState<PositionDTO[]>([]);
  const [live, setLive] = useState(true);
  const liveRef = useRef(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function refreshPositions() {
    try {
      const res = await fetch("/api/samsara/positions");
      const data = await res.json();
      setPositions(data.positions || []);
    } catch {
      /* ignore */
    }
  }

  async function syncSamsara() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/samsara/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMsg(data.error || "Sync failed");
      } else {
        setSyncMsg(`Updated ${data.updated ?? 0} of ${data.samsaraVehicles ?? 0} vehicles`);
        await refreshPositions();
      }
    } catch {
      setSyncMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  // init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = L.map(mapContainer.current, {
      center: [29.76, -95.37], // Houston TX
      zoom: 10,
      zoomControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // poll real Samsara GPS positions
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/samsara/positions");
        const data = await res.json();
        const pos: PositionDTO[] = data.positions || [];
        if (!cancelled) setPositions(pos);
      } catch {
        /* ignore */
      }
      if (!cancelled) timer = setTimeout(tick, liveRef.current ? 10000 : 30000);
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // render / update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    for (const p of positions) {
      seen.add(p.id);
      let marker = markersRef.current[p.id];
      if (!marker) {
        marker = L.marker([p.lat, p.lng], { icon: createIcon(p) })
          .bindPopup(popupHtml(p))
          .on("click", () => {
            setSelected(p.id);
            map.flyTo([p.lat, p.lng], 13);
          })
          .addTo(map);
        markersRef.current[p.id] = marker;
      } else {
        marker.setLatLng([p.lat, p.lng]);
        marker.setIcon(createIcon(p));
        marker.setPopupContent(popupHtml(p));
      }
    }
    // remove stale
    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }
  }, [positions]);

  const filtered = positions.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const movingCount = positions.filter((p) => p.status === "ACTIVE").length;

  function focus(p: PositionDTO) {
    setSelected(p.id);
    mapRef.current?.flyTo([p.lat, p.lng], 13);
    markersRef.current[p.id]?.openPopup();
  }

  function toggleLive() {
    setLive((v) => {
      liveRef.current = !v;
      return !v;
    });
  }

  return (
    <div className="grid h-[calc(100vh-9rem)] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* sidebar list */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
        <div className="border-b border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {movingCount} active · {positions.length} total
            </span>
            <button
              onClick={toggleLive}
              className={
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium " +
                (live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")
              }
            >
              {live ? <Pause size={12} /> : <Play size={12} />}
              {live ? "Live" : "Paused"}
            </button>
          </div>
          <button
            onClick={syncSamsara}
            disabled={syncing}
            className="mb-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Samsara"}
          </button>
          {syncMsg && (
            <p className="mb-2 text-center text-[11px] text-slate-500">{syncMsg}</p>
          )}
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find vehicle…"
              className="h-8 w-full rounded-lg border border-[var(--color-border)] pl-8 pr-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex-1 divide-y divide-[var(--color-border)] overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => focus(p)}
              className={
                "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 " +
                (selected === p.id ? "bg-blue-50" : "")
              }
            >
              <span
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: statusColor(p.status) }}
              >
                <Truck size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {p.assignedDriver
                    ? `${p.assignedDriver.firstName} ${p.assignedDriver.lastName}`
                    : "Unassigned"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{Math.round(p.speed)}</p>
                <p className="text-[10px] text-slate-400">mph</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* map */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)]">
        <div ref={mapContainer} className="h-full w-full" />
      </div>
    </div>
  );
}
