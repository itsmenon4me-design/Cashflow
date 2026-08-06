"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip } from "lucide-react";
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
  accounts: string[];
  onSubmit: (values: TransactionFormValues) => void;
}

function toFormValues(transaction: TransactionItem): TransactionFormValues {
  return {
    date: transaction.date,
    type: transaction.type,
    category: transaction.category,
    account: transaction.account,
    amount: transaction.amount,
    description: transaction.description,
    notes: "",
  };
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-red-500">{message}</p>;
}

export function TransactionForm({
  open,
  onOpenChange,
  mode,
  transaction,
  categories,
  accounts,
  onSubmit,
}: TransactionFormProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const title = isView
    ? uiText.transactions.viewTitle
    : isEdit
      ? uiText.transactions.editTitle
      : uiText.transactions.addTitle;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(transaction ? toFormValues(transaction) : EMPTY_FORM_VALUES);
    }
  }, [open, transaction, form]);

  const { errors } = form.formState;

  const handleSubmit = (values: TransactionFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? uiText.transactions.subtitle : formatSummary(transaction)}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transaction-date">{uiText.transactions.fieldDate}</Label>
                <Input
                  id="transaction-date"
                  type="date"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.date}
                  {...form.register("date")}
                />
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
                      onValueChange={(value) => field.onChange(value as TransactionType)}
                      disabled={isView}
                    >
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.transactions.fieldType}
                      >
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
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView}
                    >
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.transactions.fieldCategory}
                        aria-invalid={!!errors.category}
                      >
                        <SelectValue placeholder={uiText.transactions.fieldCategory} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormError message={errors.category?.message} />
              </div>

              <div className="space-y-2">
                <Label>{uiText.transactions.fieldAccount}</Label>
                <Controller
                  control={form.control}
                  name="account"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView}
                    >
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.transactions.fieldAccount}
                        aria-invalid={!!errors.account}
                      >
                        <SelectValue placeholder={uiText.transactions.fieldAccount} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account} value={account}>
                            {account}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormError message={errors.account?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-amount">{uiText.transactions.fieldAmount}</Label>
                <Input
                  id="transaction-amount"
                  type="number"
                  min="0"
                  step="1000"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.amount}
                  {...form.register("amount", { valueAsNumber: true })}
                />
                <FormError message={errors.amount?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-description">{uiText.transactions.fieldDescription}</Label>
                <Input
                  id="transaction-description"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.description}
                  {...form.register("description")}
                />
                <FormError message={errors.description?.message} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>{uiText.transactions.fieldAttachment}</Label>
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                  <Paperclip className="size-4 shrink-0" />
                  <span>{uiText.transactions.attachmentPlaceholder}</span>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="transaction-notes">{uiText.transactions.fieldNotes}</Label>
                <Textarea
                  id="transaction-notes"
                  rows={3}
                  className="min-h-11 sm:min-h-16"
                  disabled={isView}
                  aria-invalid={!!errors.notes}
                  {...form.register("notes")}
                />
                <FormError message={errors.notes?.message} />
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

function formatSummary(transaction: TransactionItem | null): string {
  if (!transaction) {
    return "";
  }
  return `${transaction.category} · ${transaction.account}`;
}
