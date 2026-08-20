"use client";

import { useEffect } from "react";
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
import { MoneyInput } from "@/components/ui/money-input";
import { EMPTY_FORM_VALUES } from "@/features/saving-goals/constants";
import {
  savingGoalFormSchema,
  type SavingGoalFormValues,
} from "@/features/saving-goals/schema";
import { formatMoney } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { uiText } from "@/locales";
import type { SavingGoalItem } from "@/services/saving-goal.service";

export type SavingGoalFormMode = "create" | "edit" | "view";

export interface SavingGoalFormOption {
  id: string;
  name: string;
}

interface SavingGoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SavingGoalFormMode;
  goal: SavingGoalItem | null;
  accounts: SavingGoalFormOption[];
  accountCurrencies?: Record<string, string>;
  categories: SavingGoalFormOption[];
  onSubmit: (values: SavingGoalFormValues) => void;
}

function toFormValues(goal: SavingGoalItem): SavingGoalFormValues {
  return {
    name: goal.name,
    description: goal.description ?? "",
    accountId: goal.accountId ?? "",
    categoryId: goal.categoryId ?? "",
    target: goal.target,
    current: goal.current,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    status: goal.status,
  };
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-red-500">{message}</p>;
}

export function SavingGoalForm({
  open,
  onOpenChange,
  mode,
  goal,
  accounts,
  accountCurrencies,
  categories,
  onSubmit,
}: SavingGoalFormProps) {
  const isView = mode === "view";

  const title = isView
    ? uiText.savingGoals.viewTitle
    : mode === "edit"
      ? uiText.savingGoals.editTitle
      : uiText.savingGoals.addTitle;

  const form = useForm<SavingGoalFormValues>({
    resolver: zodResolver(savingGoalFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(goal ? toFormValues(goal) : EMPTY_FORM_VALUES);
    }
  }, [open, goal, form]);

  const { errors } = form.formState;

  const watchedAccountId = form.watch("accountId");
  const amountCurrency = accountCurrencies?.[watchedAccountId ?? ""] ?? "IDR";

  const handleSubmit = (values: SavingGoalFormValues) => {
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
              ? uiText.savingGoals.subtitle
              : goal
                ? `${goal.name} · ${formatMoney(goal.target)}`
                : ""}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="goal-name">{uiText.savingGoals.fieldName}</Label>
                <Input
                  id="goal-name"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                <FormError message={errors.name?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-target">{uiText.savingGoals.fieldTarget}</Label>
                <Controller
                  control={form.control}
                  name="target"
                  render={({ field }) => (
                    <MoneyInput
                      id="goal-target"
                      value={field.value}
                      onValueChange={field.onChange}
                      currency={amountCurrency}
                      disabled={isView}
                      className="h-11 sm:h-9"
                      aria-invalid={!!errors.target}
                    />
                  )}
                />
                <FormError message={errors.target?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-current">{uiText.savingGoals.fieldCurrent}</Label>
                <Controller
                  control={form.control}
                  name="current"
                  render={({ field }) => (
                    <MoneyInput
                      id="goal-current"
                      value={field.value}
                      onValueChange={field.onChange}
                      currency={amountCurrency}
                      disabled={isView}
                      className="h-11 sm:h-9"
                      aria-invalid={!!errors.current}
                    />
                  )}
                />
                <FormError message={errors.current?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-start">{uiText.savingGoals.fieldStartDate}</Label>
                <Input
                  id="goal-start"
                  type="date"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.startDate}
                  {...form.register("startDate")}
                />
                <FormError message={errors.startDate?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-target-date">{uiText.savingGoals.fieldTargetDate}</Label>
                <Input
                  id="goal-target-date"
                  type="date"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.targetDate}
                  {...form.register("targetDate")}
                />
                <FormError message={errors.targetDate?.message} />
              </div>

              <div className="space-y-2">
                <Label>{uiText.savingGoals.fieldAccount}</Label>
                <Controller
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isView}>
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.savingGoals.fieldAccount}
                      >
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>{uiText.savingGoals.fieldCategory}</Label>
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isView}>
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.savingGoals.fieldCategory}
                      >
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {categoryLabel(category.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>{uiText.savingGoals.fieldStatus}</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isView}>
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.savingGoals.fieldStatus}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">{uiText.savingGoals.statusActive}</SelectItem>
                        <SelectItem value="COMPLETED">{uiText.savingGoals.statusCompleted}</SelectItem>
                        <SelectItem value="CANCELLED">{uiText.savingGoals.statusCancelled}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="goal-description">{uiText.savingGoals.fieldDescription}</Label>
                <Textarea
                  id="goal-description"
                  rows={3}
                  className="min-h-11 sm:min-h-16"
                  disabled={isView}
                  {...form.register("description")}
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