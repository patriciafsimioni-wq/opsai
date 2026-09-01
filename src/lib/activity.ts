import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

// Color styling per action, shared by the dashboard box and activity page.
export const ACTIVITY_ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  created: { bg: "#dcfce7", fg: "#166534" },
  logged: { bg: "#dcfce7", fg: "#166534" },
  requested: { bg: "#dbeafe", fg: "#1e40af" },
  updated: { bg: "#fef9c3", fg: "#854d0e" },
  approved: { bg: "#dcfce7", fg: "#166534" },
  rejected: { bg: "#fee2e2", fg: "#991b1b" },
  flagged: { bg: "#ffedd5", fg: "#9a3412" },
  deleted: { bg: "#fee2e2", fg: "#991b1b" },
};

export type ActivityInput = {
  action: string; // e.g. "created", "updated", "deleted", "approved", "rejected"
  entity: string; // e.g. "Vehicle", "Work Order", "Fuel Log", "User"
  entityLabel: string; // human-readable identifier for the record
  station?: string | null;
  detail?: string | null;
};

// Records one audit-trail row. Fire-and-forget and fully defensive: it never
// throws and never blocks the request, so a logging failure (or a database
// that hasn't had the ActivityLog table created yet) can't break a mutation.
export async function logActivity(
  user: Pick<SessionUser, "id" | "name" | "email"> | null | undefined,
  input: ActivityInput,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: user?.id ?? null,
        userName: user?.name || user?.email || "System",
        action: input.action,
        entity: input.entity,
        entityLabel: input.entityLabel,
        station: input.station ?? null,
        detail: input.detail ?? null,
      },
    });
  } catch {
    // swallow — auditing must never break the underlying operation
  }
}
