"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  EMPTY_FORM_VALUES,
} from "@/features/categories/constants";
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "@/features/categories/schema";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { CategoryItem } from "@/services/category.service";

export type CategoryFormMode = "create" | "edit" | "view";

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CategoryFormMode;
  category: CategoryItem | null;
  categories: CategoryItem[];
  onSubmit: (values: CategoryFormValues) => void;
}

function toFormValues(category: CategoryItem): CategoryFormValues {
  const icon = CATEGORY_ICONS.some((option) => option.value === category.icon)
    ? category.icon!
    : "tag";
  const color = category.color && CATEGORY_COLORS.includes(category.color)
    ? category.color
    : CATEGORY_COLORS[0];
  return {
    name: category.name,
    type: category.type,
    icon,
    color,
    description: category.description ?? "",
  };
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-red-500">{message}</p>;
}

export function CategoryForm({
  open,
  onOpenChange,
  mode,
  category,
  categories,
  onSubmit,
}: CategoryFormProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [duplicateError, setDuplicateError] = useState(false);

  const title = isView
    ? uiText.categories.viewTitle
    : isEdit
      ? uiText.categories.editTitle
      : uiText.categories.addTitle;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(category ? toFormValues(category) : EMPTY_FORM_VALUES);
    }
  }, [open, category, form]);

  const { errors } = form.formState;

  const handleSubmit = (values: CategoryFormValues) => {
    const duplicate = categories.some((item) => {
      if (item.type !== values.type) {
        return false;
      }
      if (item.name.trim().toLowerCase() !== values.name.trim().toLowerCase()) {
        return false;
      }
      return mode !== "edit" || item.id !== category?.id;
    });

    if (duplicate) {
      setDuplicateError(true);
      return;
    }

    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? uiText.categories.subtitle
              : formatSummary(category)}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-name">{uiText.categories.fieldName}</Label>
                <Input
                  id="category-name"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                <FormError message={errors.name?.message} />
                {duplicateError && (
                  <p className="text-xs text-red-500">{uiText.categories.duplicateNameError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{uiText.categories.fieldType}</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView || isEdit}
                    >
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.categories.fieldType}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCOME">
                          {uiText.transactions.typeIncome}
                        </SelectItem>
                        <SelectItem value="EXPENSE">
                          {uiText.transactions.typeExpense}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>{uiText.categories.fieldIcon}</Label>
                <Controller
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-border p-2">
                      {CATEGORY_ICONS.map((option) => {
                        const Icon = option.icon;
                        const active = field.value === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-label={option.label}
                            aria-pressed={active}
                            disabled={isView}
                            onClick={() => field.onChange(option.value)}
                            className={cn(
                              "flex h-9 items-center justify-center rounded-lg text-muted-foreground transition-colors",
                              active
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted hover:text-foreground",
                              isView && "cursor-default"
                            )}
                          >
                            <Icon className="size-4" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
                <FormError message={errors.icon?.message} />
              </div>

              <div className="space-y-2">
                <Label>{uiText.categories.fieldColor}</Label>
                <Controller
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-1.5 rounded-xl border border-border p-2">
                      {CATEGORY_COLORS.map((color) => {
                        const active = field.value === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            aria-label={color}
                            aria-pressed={active}
                            disabled={isView}
                            onClick={() => field.onChange(color)}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-lg transition-transform",
                              active && "ring-2 ring-ring ring-offset-1"
                            )}
                            style={{ backgroundColor: color }}
                          >
                            {active && <Check className="size-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
                <FormError message={errors.color?.message} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="category-description">
                  {uiText.categories.fieldDescription}
                </Label>
                <Textarea
                  id="category-description"
                  rows={3}
                  className="min-h-11 sm:min-h-16"
                  disabled={isView}
                  aria-invalid={!!errors.description}
                  {...form.register("description")}
                />
                <FormError message={errors.description?.message} />
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t bg-card px-6 py-4">
            {isView ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 sm:h-9 sm:flex-none"
                onClick={() => onOpenChange(false)}
              >
                {uiText.common.close}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => onOpenChange(false)}
                >
                  {uiText.common.cancel}
                </Button>
                <Button type="submit" className="h-11 flex-1 sm:h-9 sm:flex-none">
                  {uiText.common.save}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatSummary(category: CategoryItem | null): string {
  if (!category) {
    return "";
  }
  return category.type === "INCOME"
    ? uiText.transactions.typeIncome
    : uiText.transactions.typeExpense;
}