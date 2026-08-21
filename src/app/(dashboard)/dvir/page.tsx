import { getSession, canManage } from "@/lib/auth";
import { DvirClient } from "@/components/DvirClient";

export const dynamic = "force-dynamic";

export default async function DvirPage() {
  const user = await getSession();
  return <DvirClient canManage={user ? canManage(user.role) : false} />;
}
