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

export function isConfigured(): boolean {
  return !!API_KEY;
}
