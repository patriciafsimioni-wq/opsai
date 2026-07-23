import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DriversClient } from "@/components/DriversClient";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader title="Drivers" subtitle="Manage drivers, licenses, and safety scores." flagCategory="Drivers" />
      <DriversClient canManage={manage} />
    </div>
  );
}
