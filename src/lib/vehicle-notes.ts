import { prisma } from "@/lib/db";
import { canManage, getUserStationFilter, type SessionUser } from "@/lib/auth";

export const NOTE_MAX_LENGTH = 5000;

/** Loads the vehicle if the user's station scope allows them to see it. */
export async function findAccessibleVehicle(user: SessionUser, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, name: true, station: true },
  });
  if (!vehicle) return null;
  const stations = getUserStationFilter(user);
  if (stations !== null && !stations.includes(vehicle.station)) return null;
  return vehicle;
}

/** Authors can change their own notes; managers can change anyone's. */
export function canEditNote(user: SessionUser, note: { authorId: string | null }) {
  return canManage(user.role) || (!!note.authorId && note.authorId === user.id);
}
