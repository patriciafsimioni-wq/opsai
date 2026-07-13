import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Direct service logging was retired: every work order must now start as a
// Work Order Request and be approved before it becomes a work order.
export default function LogServicePage() {
  redirect("/work-order-requests");
}
