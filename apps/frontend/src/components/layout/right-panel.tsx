import { useEffect, useState } from "react";
import { MonthlyTargetCard } from "@/components/dashboard/MonthlyTargetCard";
import { NotificationCard } from "@/components/dashboard/NotificationCard";
import { budgetService } from "@/services/budget.service";
import { categoryLabel } from "@/lib/categories";
import type { MonthlyTargetItem } from "@/types/dashboard";

export function RightPanel() {
  const [monthlyTargets, setMonthlyTargets] =
    useState<MonthlyTargetItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadTargets = async () => {
      const now = new Date();
      setLoadFailed(false);
      try {
        const analysis = await budgetService.analysis(now.getMonth() + 1, now.getFullYear());

        if (!cancelled) {
          setMonthlyTargets(
            (analysis.categories ?? []).map((item) => ({
              id: item.categoryId,
              name: categoryLabel(item.categoryName || "Lainnya"),
              target: item.budgetAmount,
              realized: item.spentAmount,
            })),
          );
        }
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
        }
      }
    };

    void loadTargets();
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const retryTargets = () => setRetry((value) => value + 1);

  return (
    <aside className="xl:block" aria-label="Panel samping">
      <div className="grid gap-5 md:grid-cols-2 xl:sticky xl:top-20 xl:grid-cols-1">
        <MonthlyTargetCard
          items={monthlyTargets ?? []}
          loading={monthlyTargets === null && !loadFailed}
          loadFailed={loadFailed}
          onRetry={retryTargets}
        />
        <NotificationCard />
      </div>
    </aside>
  );
}
