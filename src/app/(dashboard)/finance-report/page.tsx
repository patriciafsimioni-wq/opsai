import { PageHeader } from "@/components/ui";
import { FinanceReportClient } from "@/components/FinanceReportClient";

export const dynamic = "force-dynamic";

export default function FinanceReportPage() {
  return (
    <div>
      <PageHeader
        title="PM Finance Report"
        subtitle="Preventive Maintenance — Actual to Budget Variance Analysis"
      />
      <FinanceReportClient />
    </div>
  );
}
