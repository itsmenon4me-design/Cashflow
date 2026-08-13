"use client";

import { Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { SavingGoalProgress } from "@/components/saving-goals/SavingGoalProgress";
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
import {
  estimateCompletionDate,
  statusColor,
} from "@/features/saving-goals/constants";
import { formatMoney, formatTransactionDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { SavingGoalItem } from "@/services/saving-goal.service";

function statusLabel(status: SavingGoalItem["status"]): string {
  switch (status) {
    case "COMPLETED":
      return uiText.savingGoals.statusCompleted;
    case "CANCELLED":
      return uiText.savingGoals.statusCancelled;
    default:
      return uiText.savingGoals.statusActive;
  }
}

export interface SavingGoalRowActionsProps {
  goal: SavingGoalItem;
  onView: (goal: SavingGoalItem) => void;
  onEdit: (goal: SavingGoalItem) => void;
  onDelete: (goal: SavingGoalItem) => void;
  align?: "start" | "end";
}

interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export function SavingGoalRowActions({
  goal,
  onView,
  onEdit,
  onDelete,
  align = "start",
}: SavingGoalRowActionsProps) {
  const actions: RowAction[] = [
    { label: uiText.common.view, icon: Eye, onClick: () => onView(goal) },
    { label: uiText.common.edit, icon: Pencil, onClick: () => onEdit(goal) },
    {
      label: uiText.common.delete,
      icon: Trash2,
      onClick: () => onDelete(goal),
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
                aria-label={`${action.label} ${goal.name}`}
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

interface SavingGoalTableProps {
  goals: SavingGoalItem[];
  loading?: boolean;
  onView: (goal: SavingGoalItem) => void;
  onEdit: (goal: SavingGoalItem) => void;
  onDelete: (goal: SavingGoalItem) => void;
}

export function SavingGoalTable({
  goals,
  loading = false,
  onView,
  onEdit,
  onDelete,
}: SavingGoalTableProps) {
  if (loading) {
    return (
      <>
        <div className="hidden md:block">
          <TableSkeleton rows={6} columns={7} />
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
                <TableHead>{uiText.savingGoals.fieldName}</TableHead>
                <TableHead className="text-right">{uiText.savingGoals.target}</TableHead>
                <TableHead className="text-right">{uiText.savingGoals.collected}</TableHead>
                <TableHead className="text-right">{uiText.savingGoals.remaining}</TableHead>
                <TableHead className="w-40">{uiText.savingGoals.progress}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {uiText.savingGoals.fieldTargetDate}
                </TableHead>
                <TableHead>{uiText.table.status}</TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => (
                <SavingGoalRow key={goal.id} goal={goal} onView={onView} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 md:hidden">
        {goals.map((goal) => (
          <SavingGoalCard key={goal.id} goal={goal} onView={onView} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </>
  );
}

function SavingGoalRow({
  goal,
  onView,
  onEdit,
  onDelete,
}: {
  goal: SavingGoalItem;
  onView: (goal: SavingGoalItem) => void;
  onEdit: (goal: SavingGoalItem) => void;
  onDelete: (goal: SavingGoalItem) => void;
}) {
  const estimate = estimateCompletionDate(goal);
  return (
    <TableRow key={goal.id}>
      <TableCell>
        <span className="flex flex-col">
          <span className="truncate font-medium">{goal.name}</span>
          {goal.description && (
            <span className="max-w-56 truncate text-xs text-muted-foreground">
              {goal.description}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right font-medium">{formatMoney(goal.target)}</TableCell>
      <TableCell className="text-right">{formatMoney(goal.current)}</TableCell>
      <TableCell className="text-right text-muted-foreground">
        {formatMoney(goal.remaining)}
      </TableCell>
      <TableCell>
        <SavingGoalProgress percentage={goal.percentage} />
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {uiText.savingGoals.estimate}:{" "}
          {estimate ? formatTransactionDate(estimate) : uiText.savingGoals.notEnough}
        </p>
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        {formatTransactionDate(goal.targetDate)}
      </TableCell>
      <TableCell>
        <Badge variant={statusColor(goal.status) } className="rounded-lg">
          {statusLabel(goal.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <SavingGoalRowActions goal={goal} onView={onView} onEdit={onEdit} onDelete={onDelete} align="end" />
      </TableCell>
    </TableRow>
  );
}

function SavingGoalCard({
  goal,
  onView,
  onEdit,
  onDelete,
}: {
  goal: SavingGoalItem;
  onView: (goal: SavingGoalItem) => void;
  onEdit: (goal: SavingGoalItem) => void;
  onDelete: (goal: SavingGoalItem) => void;
}) {
  const estimate = estimateCompletionDate(goal);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
          {goal.description && (
            <p className="truncate text-xs text-muted-foreground">{goal.description}</p>
          )}
        </div>
        <Badge variant={statusColor(goal.status) } className="rounded-lg shrink-0">
          {statusLabel(goal.status)}
        </Badge>
      </div>

      <SavingGoalProgress percentage={goal.percentage} />

      <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        <div>
          <p className="text-[11px]">{uiText.savingGoals.target}</p>
          <p className="font-medium text-foreground">{formatMoney(goal.target)}</p>
        </div>
        <div>
          <p className="text-[11px]">{uiText.savingGoals.collected}</p>
          <p className="font-medium text-foreground">{formatMoney(goal.current)}</p>
        </div>
        <div>
          <p className="text-[11px]">{uiText.savingGoals.remaining}</p>
          <p className="font-medium text-foreground">{formatMoney(goal.remaining)}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {uiText.savingGoals.estimate}:{" "}
        {estimate ? formatTransactionDate(estimate) : uiText.savingGoals.notEnough}
      </p>

      <div className="border-t pt-3">
        <SavingGoalRowActions goal={goal} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}