import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FuelClient } from "@/components/FuelClient";

export const dynamic = "force-dynamic";

export default async function FuelPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader title="Fuel Management" subtitle="Track fuel purchases, volume, and cost." flagCategory="Fuel" />
      <FuelClient canManage={manage} />
    </div>
  );
}
