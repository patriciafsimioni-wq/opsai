import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, canManage, canManageUsers, canLogService, canApprove, getUserStationFilter } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import type { Station } from "@prisma/client";
import { IS_TROVA } from "@/lib/constants";

/** Reads the global "fleet view" cookie (Sync Fleet only) and returns a Prisma
 *  filter value for the vehicle `fleetGroup` field, or `null` when no filtering
 *  applies (TROVA, or the "All Fleets" view). Defaults to the regular fleet so
 *  the specialty tractor/trailer fleet stays out of the way unless selected. */
export async function fleetGroupWhere(): Promise<string | null> {
  if (IS_TROVA) return null;
  const store = await cookies();
  const v = store.get("fleetView")?.value;
  if (v === "ALL") return null;
  if (v === "TRACTOR_TRAILER") return "TRACTOR_TRAILER";
  return "REGULAR";
}

/** Returns a Prisma `where` clause fragment to scope queries by the user's station(s).
 *  Returns `null` for users who can see all stations.
 *  Returns empty `in` for scoped users without a station (matches nothing). */
export function stationWhere(user: SessionUser): { station: { in: Station[] } } | null {
  const s = getUserStationFilter(user);
  if (s === null) return null; // all-station role
  // Empty array = scoped role with no station assigned = see nothing
  return { station: { in: s as Station[] } };
}

export async function requireApiUser(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

export async function requireManager(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const res = await requireApiUser();
  if ("error" in res) return res;
  if (!canManage(res.user.role)) {
    return {
      error: NextResponse.json(
        { error: "Forbidden — manager or admin role required" },
        { status: 403 },
      ),
    };
  }
  return res;
}

export async function requireUserAdmin(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const res = await requireApiUser();
  if ("error" in res) return res;
  if (!canManageUsers(res.user.role)) {
    return {
      error: NextResponse.json(
        { error: "You don't have permission to manage users" },
        { status: 403 },
      ),
    };
  }
  return res;
}

export async function requireServiceAccess(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const res = await requireApiUser();
  if ("error" in res) return res;
  if (!canLogService(res.user.role)) {
    return {
      error: NextResponse.json(
        { error: "Forbidden — insufficient permissions" },
        { status: 403 },
      ),
    };
  }
  return res;
}

export async function requireApprover(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const res = await requireApiUser();
  if ("error" in res) return res;
  if (!canApprove(res.user.role)) {
    return {
      error: NextResponse.json(
        { error: "Forbidden — approval permission required" },
        { status: 403 },
      ),
    };
  }
  return res;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
