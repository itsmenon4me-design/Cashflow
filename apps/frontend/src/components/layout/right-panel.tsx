import { MonthlyTargetCard } from "@/components/dashboard/MonthlyTargetCard";
import { NotificationCard } from "@/components/dashboard/NotificationCard";
import { monthlyTargets } from "@/lib/mock-data";

export function RightPanel() {
  return (
    <aside className="xl:block" aria-label="Panel samping">
      <div className="grid gap-5 md:grid-cols-2 xl:sticky xl:top-24 xl:grid-cols-1">
        <MonthlyTargetCard items={monthlyTargets} />
        <NotificationCard />
      </div>
    </aside>
  );
}
