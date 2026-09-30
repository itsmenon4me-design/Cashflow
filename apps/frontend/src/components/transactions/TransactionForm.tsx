"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import {
  currentLocalTime,
  formatInputDate,
  isoToInputDate,
  isoToLocalTime,
  toInputDate,
} from "@/lib/date";
import { DEFAULT_USER_TIMEZONE } from "@/lib/user-timezone";
import { categoryLabel } from "@/lib/categories";
import { EMPTY_FORM_VALUES } from "@/features/transactions/constants";
import { transactionFormSchema, type TransactionFormValues } from "@/features/transactions/schema";
import { uiText } from "@/locales";
import type { TransactionItem, TransactionType } from "@/types/dashboard";

export type TransactionFormMode = "create" | "edit" | "view";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TransactionFormMode;
  transaction: TransactionItem | null;
  categories: string[];
  categoryTypes?: Record<string, ("INCOME" | "EXPENSE")[]>;
  initialValues?: Partial<TransactionFormValues>;
  transactionType?: TransactionType;
  categoryLookupStatus?: "loading" | "error";
  onRetryCategories?: () => void;
  timeZone?: string;
  onSubmit: (values: TransactionFormValues) => void | Promise<void>;
}

function toFormValues(transaction: TransactionItem, timeZone: string): TransactionFormValues {
  return {
    date: transaction.dateTime
      ? isoToInputDate(transaction.dateTime, timeZone)
      : transaction.date,
    time: transaction.dateTime ? isoToLocalTime(transaction.dateTime, timeZone) : "",
    type: transaction.type,
    category: transaction.category,
    amount: transaction.amount,
    description: transaction.description,
    notes: transaction.note ?? transaction.description,
  };
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

export function TransactionForm({ open, onOpenChange, mode, transaction, categories, categoryTypes, initialValues, transactionType, categoryLookupStatus, onRetryCategories, timeZone = DEFAULT_USER_TIMEZONE, onSubmit }: TransactionFormProps) {
  const isView = mode === "view";
  const title = isView ? uiText.transactions.viewTitle : mode === "edit" ? uiText.transactions.editTitle : uiText.transactions.addTitle;
  const form = useForm<TransactionFormValues>({ resolver: zodResolver(transactionFormSchema), defaultValues: { ...EMPTY_FORM_VALUES, ...initialValues, type: transactionType ?? initialValues?.type ?? EMPTY_FORM_VALUES.type } });
  const selectedDate = useWatch({ control: form.control, name: "date" });
  const [selectedType, setSelectedType] = useState<TransactionType>(() => transactionType ?? transaction?.type ?? "expense");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const previousFormProps = useRef({
    open: false,
    transaction,
    initialValues,
    transactionType,
  });

  useEffect(() => {
    const previous = previousFormProps.current;
    const shouldReset =
      !previous.open ||
      previous.transaction !== transaction ||
      previous.initialValues !== initialValues ||
      previous.transactionType !== transactionType;

    if (open && shouldReset) {
      form.reset(transaction
        ? toFormValues(transaction, timeZone)
        : {
            ...EMPTY_FORM_VALUES,
            ...initialValues,
            date: initialValues?.date ?? toInputDate(new Date(), timeZone),
            time: currentLocalTime(timeZone),
            type: transactionType ?? initialValues?.type ?? EMPTY_FORM_VALUES.type,
          });
    } else if (!open) {
      setSubmitError(null);
    }

    previousFormProps.current = {
      open,
      transaction,
      initialValues,
      transactionType,
    };
  }, [open, transaction, form, initialValues, transactionType, timeZone]);

  useEffect(() => {
    if (transactionType) {
      form.setValue("type", transactionType);
      setSelectedType(transactionType);
    }
  }, [transactionType, form]);

  const visibleCategories = useMemo(() => {
    if (!categoryTypes) return categories;
    const target = selectedType === "income" ? "INCOME" : "EXPENSE";
    return categories.filter((name) => categoryTypes[name] === undefined || categoryTypes[name].includes(target));
  }, [categories, categoryTypes, selectedType]);
  const { errors } = form.formState;

  const handleSubmit = async (values: TransactionFormValues) => {
    setSubmitError(null);
    try {
      await onSubmit({ ...values, type: transactionType ?? values.type });
      onOpenChange(false);
    } catch {
      setSubmitError(uiText.transactions.saveFailed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 [&>button[data-slot=dialog-close]]:size-11">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? uiText.transactions.subtitle : categoryLabel(transaction?.category ?? "")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="transaction-date">{uiText.transactions.fieldDate}</Label>
                <div className="relative flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border border-foreground/50 bg-input/30 px-3 text-sm text-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                  <span className="pointer-events-none w-full text-center" aria-hidden="true">
                    {formatInputDate(selectedDate)}
                  </span>
                  <Input
                    id="transaction-date"
                    type="date"
                    className="date-input-no-indicator absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent opacity-0"
                    disabled={isView}
                    aria-invalid={!!errors.date}
                    {...form.register("date")}
                    onClick={(event) => event.currentTarget.showPicker?.()}
                  />
                </div>
                <FormError message={errors.date?.message} />
              </div>
              <div className="space-y-2">
                <Label>{uiText.transactions.fieldType}</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value as TransactionType);
                        setSelectedType(value as TransactionType);
                      }}
                      disabled={isView || transactionType !== undefined}
                    >
                      <SelectTrigger className="h-11 min-h-11 w-full border-foreground/50" aria-label={uiText.transactions.fieldType}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">{uiText.transactions.typeIncome}</SelectItem>
                        <SelectItem value="expense">{uiText.transactions.typeExpense}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormError message={errors.type?.message} />
              </div>
              <div className="space-y-2">
                <Label>{uiText.transactions.fieldCategory}</Label>
                {categoryLookupStatus === "loading" && (
                  <p className="text-sm text-muted-foreground" role="status">{uiText.common.loading}</p>
                )}
                {categoryLookupStatus === "error" && (
                  <div className="flex flex-wrap items-center gap-2" role="alert">
                    <p className="text-sm text-destructive">{uiText.transactions.categoryLoadFailed}</p>
                    {onRetryCategories && (
                      <Button type="button" variant="outline" className="min-h-11" onClick={onRetryCategories}>
                        {uiText.common.retry}
                      </Button>
                    )}
                  </div>
                )}
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView || categoryLookupStatus === "loading" || categoryLookupStatus === "error"}
                    >
                      <SelectTrigger
                        className="h-11 min-h-11 w-full border-foreground/50"
                        aria-label={uiText.transactions.fieldCategory}
                        aria-invalid={!!errors.category}
                      >
                        <SelectValue placeholder={uiText.transactions.fieldCategory} />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {categoryLabel(category)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormError message={errors.category?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transaction-amount">{uiText.transactions.fieldAmount}</Label>
                <Controller
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <MoneyInput
                      id="transaction-amount"
                      value={field.value}
                      onValueChange={field.onChange}
                      currency="IDR"
                      disabled={isView}
                      className="h-11 border-foreground/50"
                      aria-invalid={!!errors.amount}
                    />
                  )}
                />
                <FormError message={errors.amount?.message} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="transaction-notes">{uiText.transactions.fieldNotes}</Label>
                <Textarea
                  id="transaction-notes"
                  rows={3}
                  className="min-h-11 border-foreground/50 sm:min-h-16"
                  disabled={isView}
                  aria-invalid={!!errors.notes}
                  {...form.register("notes")}
                />
                <FormError message={errors.notes?.message} />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t bg-card px-6 py-4">
            {submitError && <p className="w-full text-sm text-red-500" role="alert">{submitError}</p>}
            {isView ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 flex-1 sm:flex-none"
                onClick={() => onOpenChange(false)}
              >
                {uiText.common.close}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-11 flex-1 sm:flex-none"
                  onClick={() => onOpenChange(false)}
                >
                  {uiText.common.cancel}
                </Button>
                <Button type="submit" className="h-11 min-h-11 flex-1 sm:flex-none">
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
