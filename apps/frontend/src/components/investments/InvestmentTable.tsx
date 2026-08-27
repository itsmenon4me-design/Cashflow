"use client";

import { Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
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
import { investmentTypeInfo } from "@/features/investments/constants";
import { formatMoney, formatTransactionDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { InvestmentItem } from "@/services/investment.service";

function statusLabel(status: InvestmentItem["status"]): string {
  switch (status) {
    case "SOLD":
      return uiText.investments.statusSold;
    case "CLOSED":
      return uiText.investments.statusClosed;
    default:
      return uiText.investments.statusActive;
  }
}

export interface InvestmentRowActionsProps {
  item: InvestmentItem;
  onView: (item: InvestmentItem) => void;
  onEdit: (item: InvestmentItem) => void;
  onDelete: (item: InvestmentItem) => void;
  align?: "start" | "end";
}

interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export function InvestmentRowActions({
  item,
  onView,
  onEdit,
  onDelete,
  align = "start",
}: InvestmentRowActionsProps) {
  const actions: RowAction[] = [
    { label: uiText.common.view, icon: Eye, onClick: () => onView(item) },
    { label: uiText.common.edit, icon: Pencil, onClick: () => onEdit(item) },
    {
      label: uiText.common.delete,
      icon: Trash2,
      onClick: () => onDelete(item),
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
                aria-label={`${action.label} ${item.name}`}
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

function ProfitLossValue({ item }: { item: InvestmentItem }) {
  const positive = item.profitLoss >= 0;
  return (
    <span className={cn("tabular-nums font-medium", positive ? "text-emerald-500" : "text-red-500")}>
      {positive ? "+" : "-"}
      {formatMoney(Math.abs(item.profitLoss), item.currency)}
      <span className="ml-1 text-xs opacity-80">
        ({item.profitLossPct.toFixed(1)}%)
      </span>
    </span>
  );
}

interface InvestmentTableProps {
  items: InvestmentItem[];
  loading?: boolean;
  onView: (item: InvestmentItem) => void;
  onEdit: (item: InvestmentItem) => void;
  onDelete: (item: InvestmentItem) => void;
}

export function InvestmentTable({
  items,
  loading = false,
  onView,
  onEdit,
  onDelete,
}: InvestmentTableProps) {
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
                <TableHead>{uiText.investments.fieldName}</TableHead>
                <TableHead>{uiText.investments.fieldPlatform}</TableHead>
                <TableHead className="text-right">{uiText.investments.totalInvested}</TableHead>
                <TableHead className="text-right">{uiText.investments.currentValue}</TableHead>
                <TableHead className="text-right">{uiText.investments.profitLoss}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {uiText.investments.fieldPurchaseDate}
                </TableHead>
                <TableHead>{uiText.table.status}</TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <InvestmentRow key={item.id} item={item} onView={onView} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 md:hidden">
        {items.map((item) => (
          <InvestmentCard key={item.id} item={item} onView={onView} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </>
  );
}

function InvestmentRow({
  item,
  onView,
  onEdit,
  onDelete,
}: {
  item: InvestmentItem;
  onView: (item: InvestmentItem) => void;
  onEdit: (item: InvestmentItem) => void;
  onDelete: (item: InvestmentItem) => void;
}) {
  const info = investmentTypeInfo(item.type);
  const Icon = info.icon;
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{item.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {info.label}
              {item.symbol ? ` · ${item.symbol}` : ""}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{item.platform}</TableCell>
      <TableCell className="text-right">{formatMoney(item.invested, item.currency)}</TableCell>
      <TableCell className="text-right font-medium">{formatMoney(item.currentValue, item.currency)}</TableCell>
      <TableCell className="text-right">
        <ProfitLossValue item={item} />
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        {formatTransactionDate(item.purchaseDate)}
      </TableCell>
      <TableCell>
        <Badge
          variant={item.status === "ACTIVE" ? "info" : "neutral"}
          className="rounded-lg"
        >
          {statusLabel(item.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <InvestmentRowActions item={item} onView={onView} onEdit={onEdit} onDelete={onDelete} align="end" />
      </TableCell>
    </TableRow>
  );
}

function InvestmentCard({
  item,
  onView,
  onEdit,
  onDelete,
}: {
  item: InvestmentItem;
  onView: (item: InvestmentItem) => void;
  onEdit: (item: InvestmentItem) => void;
  onDelete: (item: InvestmentItem) => void;
}) {
  const info = investmentTypeInfo(item.type);
  const Icon = info.icon;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {info.label} · {item.platform}
            </p>
          </div>
        </div>
        <Badge
          variant={item.status === "ACTIVE" ? "info" : "neutral"}
          className="rounded-lg shrink-0"
        >
          {statusLabel(item.status)}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground">{uiText.investments.currentValue}</p>
          <p className="text-lg font-semibold tracking-tight">{formatMoney(item.currentValue, item.currency)}</p>
        </div>
        <ProfitLossValue item={item} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <p className="text-[11px]">{uiText.investments.totalInvested}</p>
          <p className="font-medium text-foreground">{formatMoney(item.invested, item.currency)}</p>
        </div>
        <div>
          <p className="text-[11px]">{uiText.investments.fieldPurchaseDate}</p>
          <p className="font-medium text-foreground">{formatTransactionDate(item.purchaseDate)}</p>
        </div>
      </div>

      <div className="border-t pt-3">
        <InvestmentRowActions item={item} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}