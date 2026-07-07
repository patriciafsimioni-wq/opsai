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
  // NOTE: the Samsara stats endpoint is requested with `types=engineStates`
  // (plural) but returns the reading under the singular key `engineState`.
  engineState?: { time: string; value: string };
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
  behaviorLabels?: { label: string; source: string; name: string }[];
  vehicle?: { id: string; name: string };
  driver?: { id: string; name: string };
  maxAccelerationGForce?: number;
  location?: { latitude: number; longitude: number };
  coachingState?: string;
  downloadForwardVideoUrl?: string;
  downloadInwardVideoUrl?: string;
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
      "/fleet/safety-events",
      params,
    );
    const mapped = res.data.map((e) => ({
      ...e,
      behaviorLabel: e.behaviorLabel || (e.behaviorLabels?.map((b) => b.name).join(", ")) || "Unknown",
    }));
    all.push(...mapped);
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
  const drivers = await getSamsaraDrivers();
  const activeDrivers = drivers.filter((d) => d.driverActivationStatus === "active");

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const results: SamsaraDriverSafetyScore[] = [];

  for (const driver of activeDrivers) {
    try {
      const data = await samsaraFetch<{
        safetyScore: number;
        totalHarshEventCount: number;
        harshAccelCount: number;
        harshBrakingCount: number;
        harshTurningCount: number;
        crashCount: number;
        totalDistanceDrivenMeters: number;
      }>(`/v1/fleet/drivers/${driver.id}/safety/score`, {
        startMs: String(thirtyDaysAgo),
        endMs: String(now),
      });

      results.push({
        driverId: driver.id,
        driverName: driver.name,
        safetyScore: data.safetyScore,
        totalEvents: data.totalHarshEventCount,
        harshAccelCount: data.harshAccelCount,
        harshBrakeCount: data.harshBrakingCount,
        harshTurnCount: data.harshTurningCount,
        speedingCount: 0,
        crashCount: data.crashCount,
        distanceMeters: data.totalDistanceDrivenMeters,
      });
    } catch {
      // skip drivers whose score can't be fetched
    }
  }

  return results;
}

export interface SamsaraTrip {
  id?: string;
  startMs: number;
  endMs: number;
  startLocation?: string;
  endLocation?: string;
  startCoordinates?: { latitude: number; longitude: number };
  endCoordinates?: { latitude: number; longitude: number };
  distanceMeters?: number;
}

export class SamsaraPermissionError extends Error {}

// Pulls trips for a single vehicle over a time window using the v1 Trips
// endpoint. Requires the API token to have "Vehicle Trips" (read) permission —
// a 401 is surfaced as SamsaraPermissionError so callers can guide the user.
export async function getSamsaraTrips(
  vehicleId: string,
  startMs: number,
  endMs: number,
): Promise<SamsaraTrip[]> {
  const res = await fetch("https://api.samsara.com/v1/fleet/trips", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vehicleId: Number(vehicleId), startMs, endMs }),
  });
  if (res.status === 401) {
    const text = await res.text();
    throw new SamsaraPermissionError(text);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Samsara trips ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { trips?: SamsaraTrip[] };
  return json.trips ?? [];
}

export function isConfigured(): boolean {
  return !!API_KEY;
}
