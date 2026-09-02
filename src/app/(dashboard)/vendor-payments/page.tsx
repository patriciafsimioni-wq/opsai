import { getSession, canManage } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IS_TROVA } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { VendorPaymentsClient } from "@/components/VendorPaymentsClient";

export const dynamic = "force-dynamic";

export default async function VendorPaymentsPage() {
  if (!IS_TROVA) redirect("/");
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canManage(user.role)) redirect("/");
  return (
    <div>
      <PageHeader
        title="Vendor Payments"
        subtitle="Track labor owed to each vendor and record when and how they were paid."
      />
      <VendorPaymentsClient />
    </div>
  );
}
