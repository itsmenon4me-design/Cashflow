import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  FileText,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uiText } from "@/locales";

interface QuickAction {
  label: string;
  icon: LucideIcon;
}

const quickActions: QuickAction[] = [
  { label: uiText.common.addTransaction, icon: ReceiptText },
  { label: uiText.common.addIncome, icon: ArrowDownToLine },
  { label: uiText.common.addExpense, icon: ArrowUpFromLine },
  { label: uiText.common.transfer, icon: ArrowLeftRight },
  { label: uiText.common.viewReport, icon: FileText },
];

export function QuickActionCard() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{uiText.dashboard.quickActions}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant="secondary"
              className="h-11 w-full justify-start rounded-xl sm:h-9"
              onClick={() => undefined}
            >
              <Icon className="text-primary" />
              <span>{action.label}</span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
