"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Truck, Pause, Play, Search } from "lucide-react";
import type { PositionDTO, GeofenceDTO } from "@/lib/types";
import { VEHICLE_STATUS, GEOFENCE_TYPE } from "@/lib/constants";

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function circlePolygon(lng: number, lat: number, radiusM: number, points = 48) {
  const coords: [number, number][] = [];
  const distX = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const distY = radiusM / 110540;
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([lng + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
  }
  return coords;
}

function statusColor(status: string) {
  return (
    VEHICLE_STATUS[status as keyof typeof VEHICLE_STATUS]?.color ?? "#64748b"
  );
}

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const [positions, setPositions] = useState<PositionDTO[]>([]);
  const [geofences, setGeofences] = useState<GeofenceDTO[]>([]);
  const [live, setLive] = useState(true);
  const liveRef = useRef(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE,
      center: [-122.4194, 37.7749],
      zoom: 10,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // load geofences once and draw
  useEffect(() => {
    fetch("/api/geofences")
      .then((r) => r.json())
      .then((data: GeofenceDTO[]) => setGeofences(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || geofences.length === 0) return;
    const draw = () => {
      const fc = {
        type: "FeatureCollection" as const,
        features: geofences.map((f) => ({
          type: "Feature" as const,
          properties: { color: f.color, name: f.name },
          geometry: {
            type: "Polygon" as const,
            coordinates: [circlePolygon(f.centerLng, f.centerLat, f.radiusM)],
          },
        })),
      };
      const src = map.getSource("geofences") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(fc);
      } else {
        map.addSource("geofences", { type: "geojson", data: fc });
        map.addLayer({
          id: "geofences-fill",
          type: "fill",
          source: "geofences",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: "geofences-line",
          type: "line",
          source: "geofences",
          paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [2, 1] },
        });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [geofences]);

  // poll simulation
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function tick() {
      try {
        const endpoint = liveRef.current ? "/api/simulate" : "/api/positions";
        const res = await fetch(endpoint, {
          method: liveRef.current ? "POST" : "GET",
        });
        const data = await res.json();
        const pos: PositionDTO[] = liveRef.current ? data.positions : data;
        if (!cancelled) setPositions(pos);
      } catch {
        /* ignore */
      }
      if (!cancelled) timer = setTimeout(tick, 3000);
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
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = markerHtml(p);
        el.addEventListener("click", () => {
          setSelected(p.id);
          map.flyTo({ center: [p.lng, p.lat], zoom: 13 });
        });
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
              popupHtml(p),
            ),
          )
          .addTo(map);
        markersRef.current[p.id] = marker;
      } else {
        marker.setLngLat([p.lng, p.lat]);
        const el = marker.getElement();
        el.innerHTML = markerHtml(p);
        marker.getPopup()?.setHTML(popupHtml(p));
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
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 13 });
    markersRef.current[p.id]?.togglePopup();
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
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-white/90 px-3 py-2 text-xs shadow backdrop-blur">
          <p className="font-semibold text-slate-700">Geofences</p>
          <div className="mt-1 space-y-0.5">
            {Object.entries(GEOFENCE_TYPE).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
                <span className="text-slate-500">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function markerHtml(p: PositionDTO) {
  const color = statusColor(p.status);
  const moving = p.status === "ACTIVE";
  return `
    <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
      ${moving ? `<span style="position:absolute;width:30px;height:30px;border-radius:50%;background:${color};opacity:.35;animation:pulse-ring 1.6s ease-out infinite;"></span>` : ""}
      <span style="position:relative;width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;transform:rotate(${p.heading}deg);">
        <span style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid #fff;margin-top:-2px;"></span>
      </span>
    </div>`;
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
