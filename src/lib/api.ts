import { NextResponse } from "next/server";
import { getSession, canManage, canLogService, canApprove } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

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
