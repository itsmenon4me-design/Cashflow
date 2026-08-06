import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { MonthlyTargetCard } from "@/components/dashboard/MonthlyTargetCard";
import { NotificationCard } from "@/components/dashboard/NotificationCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { monthlyTargets, notifications, recentActivities } from "@/lib/mock-data";

export function RightPanel() {
  return (
    <aside className="hidden xl:block" aria-label="Panel samping">
      <div className="sticky top-24 space-y-5">
        <ActivityCard items={recentActivities} />
        <MonthlyTargetCard items={monthlyTargets} />
        <NotificationCard items={notifications} />
        <QuickActionCard />
      </div>
    </aside>
  );
}
