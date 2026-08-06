import { getSession, canManage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { RentalVehiclesClient } from "@/components/RentalVehiclesClient";

export const dynamic = "force-dynamic";

export default async function RentalVehiclesPage() {
  const user = await getSession();
  const manage = user ? canManage(user.role) : false;
  return (
    <div>
      <PageHeader
        title="Rental Vehicles"
        subtitle="Track rented vehicles, rental windows, costs, and invoice photos by station."
        flagCategory="Vehicles"
      />
      <RentalVehiclesClient canManage={manage} />
    </div>
  );
}
