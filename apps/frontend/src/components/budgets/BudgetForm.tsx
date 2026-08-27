"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YearStepper } from "@/components/ui/year-stepper";
import { getEmptyFormValues, MONTH_OPTIONS } from "@/features/budgets/constants";
import { categoryLabel } from "@/lib/categories";
import {
  budgetFormSchema,
  type BudgetFormValues,
} from "@/features/budgets/schema";
import { uiText } from "@/locales";
import type { BudgetItem } from "@/services/budget.service";

export type BudgetFormMode = "create" | "edit" | "view";

export interface BudgetCategoryOption {
  id: string;
  name: string;
}

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: BudgetFormMode;
  budget: BudgetItem | null;
  categories: BudgetCategoryOption[];
  budgets: BudgetItem[];
  /** Hard floor for the year stepper (year the account was created). */
  minYear?: number;
  onSubmit: (values: BudgetFormValues) => void;
}

function toFormValues(budget: BudgetItem): BudgetFormValues {
  return {
    categoryId: budget.categoryId,
    amount: budget.amount,
    month: budget.month,
    year: budget.year,
  };
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-red-500">{message}</p>;
}

export function BudgetForm({
  open,
  onOpenChange,
  mode,
  budget,
  categories,
  budgets,
  minYear,
  onSubmit,
}: BudgetFormProps) {
  const isView = mode === "view";
  const [duplicateError, setDuplicateError] = useState(false);

  const title = isView
    ? uiText.budgets.viewTitle
    : mode === "edit"
      ? uiText.budgets.editTitle
      : uiText.budgets.addTitle;

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: getEmptyFormValues(),
  });

  useEffect(() => {
    if (open) {
      form.reset(budget ? toFormValues(budget) : getEmptyFormValues());
    }
  }, [open, budget, form]);

  const { errors } = form.formState;

  const handleSubmit = (values: BudgetFormValues) => {
    const duplicate = budgets.some((item) => {
      if (item.categoryId !== values.categoryId) {
        return false;
      }
      if (item.month !== values.month || item.year !== values.year) {
        return false;
      }
      return mode !== "edit" || item.id !== budget?.id;
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
            {mode === "create" ? uiText.budgets.subtitle : formatSummary(budget)}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>{uiText.budgets.fieldCategory}</Label>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isView}>
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.budgets.fieldCategory}
                        aria-invalid={!!errors.categoryId}
                      >
                        <SelectValue placeholder={uiText.budgets.fieldCategory} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {categoryLabel(category.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormError message={errors.categoryId?.message} />
                {duplicateError && (
                  <p className="text-xs text-red-500">{uiText.budgets.duplicateError}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="budget-amount">{uiText.budgets.fieldAmount}</Label>
                <Controller
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <MoneyInput
                      id="budget-amount"
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView}
                      className="h-11 sm:h-9"
                      aria-invalid={!!errors.amount}
                    />
                  )}
                />
                <FormError message={errors.amount?.message} />
              </div>

              <div className="space-y-2">
                <Label>{uiText.budgets.fieldMonth}</Label>
                <Controller
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => field.onChange(Number(value))}
                      disabled={isView}
                    >
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.budgets.fieldMonth}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>{uiText.budgets.fieldYear}</Label>
                <Controller
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <YearStepper
                      value={field.value}
                      minYear={minYear}
                      disabled={isView}
                      onChange={field.onChange}
                      ariaLabel={uiText.budgets.fieldYear}
                      className="h-11 sm:h-9"
                    />
                  )}
                />
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

function formatSummary(budget: BudgetItem | null): string {
  if (!budget) {
    return "";
  }
  return `${budget.categoryName} · ${budget.month}-${budget.year}`;
}