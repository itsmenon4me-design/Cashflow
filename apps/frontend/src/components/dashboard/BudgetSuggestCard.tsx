"use client";

import { useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import {
  BudgetForm,
  type BudgetCategoryOption,
} from "@/components/budgets/BudgetForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getYearOptions } from "@/features/budgets/constants";
import {
  toCreateBudgetPayload,
  type BudgetFormValues,
} from "@/features/budgets/schema";
import { uiText } from "@/locales";
import { budgetService } from "@/services/budget.service";
import { categoryService } from "@/services/category.service";
import { useDataRefreshStore } from "@/stores/refresh.store";

export function BudgetSuggestCard() {
  const bump = useDataRefreshStore((state) => state.bump);
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<BudgetCategoryOption[] | null>(null);
  const [loadingCats, setLoadingCats] = useState(false);
  const [error, setError] = useState(false);

  const openForm = async () => {
    if (categories) {
      setOpen(true);
      return;
    }
    setLoadingCats(true);
    setError(false);
    try {
      const list = await categoryService.list();
      setCategories(
        list
          .filter((category) => category.type === "EXPENSE")
          .map((category) => ({ id: category.id, name: category.name })),
      );
      setOpen(true);
    } catch {
      setError(true);
    } finally {
      setLoadingCats(false);
    }
  };

  const handleSubmit = async (values: BudgetFormValues) => {
    try {
      await budgetService.create(toCreateBudgetPayload(values));
      bump();
    } catch {
      setError(true);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-muted-foreground" />
          {uiText.budgets.dashboardTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{uiText.budgets.dashboardSubtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-foreground">{uiText.budgets.noBudgetTitle}</p>
        <p className="text-sm text-muted-foreground">{uiText.budgets.noBudgetSubtitle}</p>
        {error && <p className="text-xs text-red-500">{uiText.states.errorDescription}</p>}
        <Button
          type="button"
          className="rounded-xl"
          loading={loadingCats}
          onClick={() => void openForm()}
        >
          {!loadingCats && <Plus />}
          {uiText.common.createBudget}
        </Button>
      </CardContent>
      <BudgetForm
        open={open}
        onOpenChange={setOpen}
        mode="create"
        budget={null}
        categories={categories ?? []}
        budgets={[]}
        years={getYearOptions()}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </Card>
  );
}