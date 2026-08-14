import { PageHeader } from "@/components/ui";
import { BudgetEditorClient } from "@/components/BudgetEditorClient";

export const dynamic = "force-dynamic";

export default function BudgetEditorPage() {
  return (
    <div>
      <PageHeader
        title="PM Budgets"
        subtitle="Edit preventive maintenance budget allocations by station, category, and month."
      />
      <BudgetEditorClient />
    </div>
  );
}
