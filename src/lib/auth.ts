import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "fleet_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-fleet-secret-change-me",
);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  station: string | null;
  driverId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
      station: (payload.station as string | null) ?? null,
      driverId: (payload.driverId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    station: user.station,
    driverId: user.driverId,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

// Role hierarchy — higher roles include lower-tier permissions
const MANAGEMENT_ROLES: Role[] = ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "STATION_MANAGER", "MANAGER", "MECHANIC"];
const APPROVAL_ROLES: Role[] = ["ADMIN", "GENERAL_MANAGER", "FLEET_MANAGER", "MANAGER"];
const SERVICE_ROLES: Role[] = [...MANAGEMENT_ROLES, "MECHANIC", "VENDOR"];

export function canManage(role: Role) {
  return MANAGEMENT_ROLES.includes(role);
}

export function canApprove(role: Role) {
  return APPROVAL_ROLES.includes(role);
}

export function canLogService(role: Role) {
  return SERVICE_ROLES.includes(role);
}

export function canViewFinance(role: Role) {
  return role !== "VENDOR" && role !== "DRIVER";
}

export function canViewSafety(role: Role) {
  return role !== "VENDOR";
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    ADMIN: "Administrator",
    GENERAL_MANAGER: "General Manager",
    FLEET_MANAGER: "Fleet Manager",
    STATION_MANAGER: "Station Manager",
    MECHANIC: "Mechanic",
    VENDOR: "Vendor",
    MANAGER: "Manager",
    DRIVER: "Driver",
  };
  return labels[role] || role;
}
