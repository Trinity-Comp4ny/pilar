import { Clock } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Timesheet() {
  usePageTitle("Timesheet");

  return (
    <PageLayout>
      <PageHeader title="Timesheet" />
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="p-4 rounded-full bg-muted">
          <Clock className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Em breve</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registre suas horas por projeto
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
