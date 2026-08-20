"use client";

import { Eye, Pencil, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { BudgetProgress } from "@/components/budgets/BudgetProgress";
import { CardSkeleton } from "@/components/states/CardSkeleton";
import { TableSkeleton } from "@/components/states/TableSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MONTH_OPTIONS } from "@/features/budgets/constants";
import { formatMoney } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { BudgetItem } from "@/services/budget.service";

function monthLabel(month: number): string {
  return MONTH_OPTIONS.find((option) => option.value === month)?.label ?? String(month);
}

export interface BudgetRowActionsProps {
  budget: BudgetItem;
  onView: (budget: BudgetItem) => void;
  onEdit: (budget: BudgetItem) => void;
  onDelete: (budget: BudgetItem) => void;
  align?: "start" | "end";
}

interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export function BudgetRowActions({
  budget,
  onView,
  onEdit,
  onDelete,
  align = "start",
}: BudgetRowActionsProps) {
  const actions: RowAction[] = [
    { label: uiText.common.view, icon: Eye, onClick: () => onView(budget) },
    { label: uiText.common.edit, icon: Pencil, onClick: () => onEdit(budget) },
    {
      label: uiText.common.delete,
      icon: Trash2,
      onClick: () => onDelete(budget),
      destructive: true,
    },
  ];

  return (
    <div className={cn("flex items-center gap-0.5", align === "end" && "justify-end")}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Tooltip key={action.label} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label={`${action.label} ${budget.categoryName}`}
                className={cn(
                  "size-11 md:size-8",
                  action.destructive
                    ? "hover:bg-destructive/10 hover:text-destructive"
                    : "hover:text-foreground"
                )}
                onClick={action.onClick}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{action.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

interface BudgetTableProps {
  budgets: BudgetItem[];
  loading?: boolean;
  onView: (budget: BudgetItem) => void;
  onEdit: (budget: BudgetItem) => void;
  onDelete: (budget: BudgetItem) => void;
}

export function BudgetTable({
  budgets,
  loading = false,
  onView,
  onEdit,
  onDelete,
}: BudgetTableProps) {
  if (loading) {
    return (
      <>
        <div className="hidden md:block">
          <TableSkeleton rows={6} columns={6} />
        </div>
        <div className="md:hidden">
          <CardSkeleton variant="list" rows={4} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{uiText.table.category}</TableHead>
                <TableHead>{uiText.budgets.period}</TableHead>
                <TableHead className="text-right">{uiText.budgets.totalBudget}</TableHead>
                <TableHead className="text-right">{uiText.budgets.totalSpent}</TableHead>
                <TableHead className="text-right">{uiText.budgets.remaining}</TableHead>
                <TableHead className="w-40">{uiText.budgets.usage}</TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((budget) => {
                const over = budget.spent > budget.amount && budget.amount > 0;
                return (
                  <TableRow key={budget.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="truncate font-medium">{categoryLabel(budget.categoryName)}</span>
                        {over && <OverLine />}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {monthLabel(budget.month)} {budget.year}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(budget.amount)}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(budget.spent)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatMoney(budget.remaining)}
                    </TableCell>
                    <TableCell>
                      <BudgetProgress percentage={budget.percentage} />
                    </TableCell>
                    <TableCell className="text-right">
                      <BudgetRowActions
                        budget={budget}
                        onView={onView}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        align="end"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 md:hidden">
        {budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}

function OverLine() {
  return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <TriangleAlert className="size-3" />
      {uiText.budgets.overBudget}
    </span>
  );
}

function BudgetCard({
  budget,
  onView,
  onEdit,
  onDelete,
}: {
  budget: BudgetItem;
  onView: (budget: BudgetItem) => void;
  onEdit: (budget: BudgetItem) => void;
  onDelete: (budget: BudgetItem) => void;
}) {
  const over = budget.spent > budget.amount && budget.amount > 0;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{categoryLabel(budget.categoryName)}</p>
          <p className="text-xs text-muted-foreground">
            {monthLabel(budget.month)} {budget.year}
          </p>
        </div>
        {over && <Badge variant="danger" className="rounded-lg">{uiText.budgets.overBudget}</Badge>}
      </div>

      <BudgetProgress percentage={budget.percentage} />

      <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        <div>
          <p className="text-[11px]">{uiText.budgets.totalBudget}</p>
          <p className="font-medium text-foreground">{formatMoney(budget.amount)}</p>
        </div>
        <div>
          <p className="text-[11px]">{uiText.budgets.totalSpent}</p>
          <p className="font-medium text-foreground">{formatMoney(budget.spent)}</p>
        </div>
        <div>
          <p className="text-[11px]">{uiText.budgets.remaining}</p>
          <p className="font-medium text-foreground">{formatMoney(budget.remaining)}</p>
        </div>
      </div>

      <div className="border-t pt-3">
        <BudgetRowActions budget={budget} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}