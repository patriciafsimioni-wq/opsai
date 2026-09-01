import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PartsSuppliesClient } from "@/components/PartsSuppliesClient";

export const dynamic = "force-dynamic";

export default async function PartsSuppliesPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="Parts & Supplies"
        subtitle="Fleet parts & supply purchases (AutoZone, O'Reilly…) not tied to a specific vehicle."
        flagCategory="Finance"
      />
      <PartsSuppliesClient canManage={manage} />
    </div>
  );
}
