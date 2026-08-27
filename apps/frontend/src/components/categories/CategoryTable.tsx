"use client";

import { CategoryCard, CategoryRowActions } from "@/components/categories/CategoryCard";
import { CardSkeleton } from "@/components/states/CardSkeleton";
import { TableSkeleton } from "@/components/states/TableSkeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoryIconInfo } from "@/features/categories/constants";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { CategoryItem } from "@/services/category.service";

interface CategoryTableProps {
  categories: CategoryItem[];
  loading?: boolean;
  onView: (category: CategoryItem) => void;
  onEdit: (category: CategoryItem) => void;
  onDelete: (category: CategoryItem) => void;
}

export function CategoryTable({
  categories,
  loading = false,
  onView,
  onEdit,
  onDelete,
}: CategoryTableProps) {
  if (loading) {
    return (
      <>
        <div className="hidden md:block">
          <TableSkeleton rows={6} columns={4} />
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
                <TableHead>{uiText.categories.fieldName}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {uiText.categories.fieldDescription}
                </TableHead>
                <TableHead>{uiText.table.status}</TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => {
                const Icon = categoryIconInfo(category.icon).icon;
                return (
                  <TableRow key={category.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                          style={
                            category.color
                              ? { backgroundColor: `${category.color}22`, color: category.color }
                              : undefined
                          }
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{categoryLabel(category.name)}</span>
                          <span className="text-xs text-muted-foreground">{category.type}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-64 truncate text-muted-foreground sm:table-cell">
                      {category.description ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={category.isActive ? "success" : "neutral"}
                        className={cn("rounded-lg")}
                      >
                        {category.isActive
                          ? uiText.categories.active
                          : uiText.categories.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <CategoryRowActions
                        category={category}
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
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}