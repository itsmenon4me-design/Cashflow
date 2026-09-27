import { Card, CardContent } from "@/components/ui/card";
import { DataLoadingState } from "@/components/states/DataLoadingState";
import { uiText } from "@/locales";

type TransactionPageLoadingProps = {
  type: "income" | "expense" | "all";
};

export function TransactionPageLoading({ type }: TransactionPageLoadingProps) {
  const title =
    type === "income"
      ? uiText.navigation.income
      : type === "expense"
        ? uiText.navigation.expense
        : uiText.transactions.title;
  const subtitle =
    type === "income"
      ? uiText.transactions.incomeSubtitle
      : type === "expense"
        ? uiText.transactions.expenseSubtitle
        : uiText.transactions.subtitle;

  return (
    <div className="space-y-6">
      <div className="min-h-[72px]">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {uiText.transactions.count.replace("{count}", "0")}
        </p>
        <span aria-hidden="true" className="h-9 w-36 rounded-xl bg-primary/60" />
      </div>

      <Card className="shadow-sm">
        <CardContent className="min-h-[84px]" />
      </Card>

      <DataLoadingState />
    </div>
  );
}
