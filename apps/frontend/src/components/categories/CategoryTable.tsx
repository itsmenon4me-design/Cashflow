"use client";

import {
  CategoryCard,
  CategoryRowActions,
  CategoryStatusBadge,
  CategoryTypeBadge,
} from "@/components/categories/CategoryCard";
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
import { uiText } from "@/locales";
import type { CategoryItem } from "@/services/category.service";

interface CategoryTableProps {
  categories: CategoryItem[];
  onView: (category: CategoryItem) => void;
  onEdit: (category: CategoryItem) => void;
  onDelete: (category: CategoryItem) => void;
}

export function CategoryTable({
  categories,
  onView,
  onEdit,
  onDelete,
}: CategoryTableProps) {
  return (
    <>
      <div className="hidden xl:block">
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{uiText.categories.fieldName}</TableHead>
                <TableHead>{uiText.categories.fieldType}</TableHead>
                <TableHead>{uiText.categories.fieldDescription}</TableHead>
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
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <CategoryTypeBadge type={category.type} />
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {category.description || "-"}
                    </TableCell>
                    <TableCell>
                      <CategoryStatusBadge isActive={category.isActive} />
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

      <div className="grid gap-4 xl:hidden">
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