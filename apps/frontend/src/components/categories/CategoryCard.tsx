"use client";

import { Eye, Lock, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { categoryIconInfo } from "@/features/categories/constants";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { CategoryItem } from "@/services/category.service";

export interface CategoryRowActionsProps {
  category: CategoryItem;
  onView: (category: CategoryItem) => void;
  onEdit: (category: CategoryItem) => void;
  onDelete: (category: CategoryItem) => void;
  align?: "start" | "end";
}

interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export function CategoryRowActions({
  category,
  onView,
  onEdit,
  onDelete,
  align = "start",
}: CategoryRowActionsProps) {
  const actions: RowAction[] = [
    { label: uiText.common.view, icon: Eye, onClick: () => onView(category) },
    ...(category.isSystem
      ? ([
          { label: uiText.categories.system, icon: Lock, onClick: () => undefined },
        ] as RowAction[])
      : ([
          { label: uiText.common.edit, icon: Pencil, onClick: () => onEdit(category) },
          {
            label: uiText.common.delete,
            icon: Trash2,
            onClick: () => onDelete(category),
            destructive: true,
          },
        ] as RowAction[])),
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
                aria-label={`${action.label} ${category.name}`}
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

interface CategoryCardProps {
  category: CategoryItem;
  onView: (category: CategoryItem) => void;
  onEdit: (category: CategoryItem) => void;
  onDelete: (category: CategoryItem) => void;
}

export function CategoryCard({
  category,
  onView,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const info = categoryIconInfo(category.icon);
  const Icon = info.icon;

  return (
    <Card size="sm" className="shadow-sm">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
            style={
              category.color
                ? { backgroundColor: `${category.color}22`, color: category.color }
                : undefined
            }
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{categoryLabel(category.name)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {category.isSystem ? uiText.categories.system : uiText.categories.active}
            </p>
          </div>
        </div>

        {category.description && (
          <p className="text-xs text-muted-foreground">{category.description}</p>
        )}

        <div className="border-t pt-3">
          <CategoryRowActions
            category={category}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}