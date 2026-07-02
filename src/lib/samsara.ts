const SAMSARA_BASE = "https://api.samsara.com";
const API_KEY = process.env.SAMSARA_API_KEY ?? "";

interface SamsaraVehicle {
  id: string;
  name: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  licensePlate?: string;
  cameraSerial?: string;
  tags?: { id: string; name: string }[];
}

interface SamsaraVehicleStat {
  id: string;
  name: string;
  obdOdometerMeters?: { time: string; value: number };
  gpsOdometerMeters?: { time: string; value: number };
  engineStates?: { time: string; value: string };
  gps?: { time: string; latitude: number; longitude: number; headingDegrees: number; speedMilesPerHour: number };
}

async function samsaraFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, SAMSARA_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Samsara API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getSamsaraVehicles(): Promise<SamsaraVehicle[]> {
  const all: SamsaraVehicle[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { limit: "200" };
    if (cursor) params.after = cursor;
    const res = await samsaraFetch<{ data: SamsaraVehicle[]; pagination: { endCursor: string; hasNextPage: boolean } }>(
      "/fleet/vehicles",
      params,
    );
    all.push(...res.data);
    cursor = res.pagination.hasNextPage ? res.pagination.endCursor : undefined;
  } while (cursor);
  return all;
}

export async function getSamsaraVehicleStats(): Promise<SamsaraVehicleStat[]> {
  const all: SamsaraVehicleStat[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = {
      types: "obdOdometerMeters,gpsOdometerMeters,engineStates,gps",
      limit: "200",
    };
    if (cursor) params.after = cursor;
    const res = await samsaraFetch<{ data: SamsaraVehicleStat[]; pagination: { endCursor: string; hasNextPage: boolean } }>(
      "/fleet/vehicles/stats",
      params,
    );
    all.push(...res.data);
    cursor = res.pagination.hasNextPage ? res.pagination.endCursor : undefined;
  } while (cursor);
  return all;
}

const METERS_TO_MILES = 0.000621371;

export function metersToMiles(meters: number): number {
  return Math.round(meters * METERS_TO_MILES);
}

export function extractDxNumber(name: string): string | null {
  const match = name.match(/^(DX\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

export interface SamsaraDriver {
  id: string;
  name: string;
  username?: string;
  driverActivationStatus: string;
  phone?: string;
  tags?: { id: string; name: string }[];
  profileImageUrl?: string;
  createdAtTime?: string;
  carrierSettings?: { carrierName?: string; homeTerminalName?: string };
}

export async function getSamsaraDrivers(): Promise<SamsaraDriver[]> {
  const all: SamsaraDriver[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { limit: "200" };
    if (cursor) params.after = cursor;
    const res = await samsaraFetch<{ data: SamsaraDriver[]; pagination: { endCursor: string; hasNextPage: boolean } }>(
      "/fleet/drivers",
      params,
    );
    all.push(...res.data);
    cursor = res.pagination.hasNextPage ? res.pagination.endCursor : undefined;
  } while (cursor);
  return all;
}

export async function getSamsaraGpsPositions(): Promise<SamsaraVehicleStat[]> {
  const all: SamsaraVehicleStat[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = {
      types: "gps,engineStates",
      limit: "200",
    };
    if (cursor) params.after = cursor;
    const res = await samsaraFetch<{ data: SamsaraVehicleStat[]; pagination: { endCursor: string; hasNextPage: boolean } }>(
      "/fleet/vehicles/stats",
      params,
    );
    all.push(...res.data);
    cursor = res.pagination.hasNextPage ? res.pagination.endCursor : undefined;
  } while (cursor);
  return all;
}

export interface SamsaraSafetyEvent {
  id: string;
  time: string;
  behaviorLabel: string;
  vehicle?: { id: string; name: string };
  driver?: { id: string; name: string };
  maxAccelerationGForce?: number;
  location?: { latitude: number; longitude: number };
}

export async function getSamsaraSafetyEvents(startMs: number, endMs: number): Promise<SamsaraSafetyEvent[]> {
  const all: SamsaraSafetyEvent[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = {
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      limit: "200",
    };
    if (cursor) params.after = cursor;
    const res = await samsaraFetch<{ data: SamsaraSafetyEvent[]; pagination: { endCursor: string; hasNextPage: boolean } }>(
      "/fleet/safety/events",
      params,
    );
    all.push(...res.data);
    cursor = res.pagination.hasNextPage ? res.pagination.endCursor : undefined;
  } while (cursor);
  return all;
}

export interface SamsaraDriverSafetyScore {
  driverId: string;
  driverName: string;
  safetyScore: number;
  totalEvents: number;
  harshAccelCount: number;
  harshBrakeCount: number;
  harshTurnCount: number;
  speedingCount: number;
  crashCount: number;
  distanceMeters: number;
}

export async function getSamsaraDriverSafetyScores(): Promise<SamsaraDriverSafetyScore[]> {
  // Samsara doesn't have a direct "safety score" endpoint in v1,
  // so we compute from safety events in the last 30 days
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const events = await getSamsaraSafetyEvents(thirtyDaysAgo, now);

  const driverMap = new Map<string, SamsaraDriverSafetyScore>();

  for (const evt of events) {
    if (!evt.driver) continue;
    const dId = evt.driver.id;
    if (!driverMap.has(dId)) {
      driverMap.set(dId, {
        driverId: dId,
        driverName: evt.driver.name,
        safetyScore: 100,
        totalEvents: 0,
        harshAccelCount: 0,
        harshBrakeCount: 0,
        harshTurnCount: 0,
        speedingCount: 0,
        crashCount: 0,
        distanceMeters: 0,
      });
    }
    const d = driverMap.get(dId)!;
    d.totalEvents++;
    const label = evt.behaviorLabel?.toLowerCase() ?? "";
    if (label.includes("accel")) d.harshAccelCount++;
    else if (label.includes("brak")) d.harshBrakeCount++;
    else if (label.includes("turn") || label.includes("corner")) d.harshTurnCount++;
    else if (label.includes("speed")) d.speedingCount++;
    else if (label.includes("crash") || label.includes("collision")) d.crashCount++;
  }

  // Compute safety score: start at 100, deduct per event type
  for (const d of driverMap.values()) {
    let score = 100;
    score -= d.crashCount * 15;
    score -= d.speedingCount * 3;
    score -= d.harshBrakeCount * 2;
    score -= d.harshAccelCount * 2;
    score -= d.harshTurnCount * 1;
    d.safetyScore = Math.max(0, Math.min(100, score));
  }

  return Array.from(driverMap.values());
}

export function isConfigured(): boolean {
  return !!API_KEY;
}
