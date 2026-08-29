"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { currentLocalTime, isoToLocalTime } from "@/lib/date";
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
  onSubmit: (values: TransactionFormValues) => void | Promise<void>;
}

function toFormValues(transaction: TransactionItem): TransactionFormValues {
  return { date: transaction.date, time: transaction.dateTime ? isoToLocalTime(transaction.dateTime) : "", type: transaction.type, category: transaction.category, amount: transaction.amount, description: transaction.description, notes: transaction.note ?? "" };
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

export function TransactionForm({ open, onOpenChange, mode, transaction, categories, categoryTypes, initialValues, transactionType, onSubmit }: TransactionFormProps) {
  const isView = mode === "view";
  const title = isView ? uiText.transactions.viewTitle : mode === "edit" ? uiText.transactions.editTitle : uiText.transactions.addTitle;
  const form = useForm<TransactionFormValues>({ resolver: zodResolver(transactionFormSchema), defaultValues: { ...EMPTY_FORM_VALUES, ...initialValues, type: transactionType ?? initialValues?.type ?? EMPTY_FORM_VALUES.type } });
  const [selectedType, setSelectedType] = useState<TransactionType>(() => transactionType ?? transaction?.type ?? "expense");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) form.reset(transaction ? toFormValues(transaction) : { ...EMPTY_FORM_VALUES, ...initialValues, time: currentLocalTime(), type: transactionType ?? initialValues?.type ?? EMPTY_FORM_VALUES.type });
    else setSubmitError(null);
  }, [open, transaction, form, initialValues, transactionType]);

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

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0"><DialogHeader className="border-b px-6 pt-6 pb-4"><DialogTitle className="pr-8">{title}</DialogTitle><DialogDescription>{mode === "create" ? uiText.transactions.subtitle : categoryLabel(transaction?.category ?? "")}</DialogDescription></DialogHeader><form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden"><div className="flex-1 space-y-4 overflow-y-auto px-6 py-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="transaction-date">{uiText.transactions.fieldDate}</Label><Input id="transaction-date" type="date" className="h-11 sm:h-9" disabled={isView} aria-invalid={!!errors.date} {...form.register("date")} /><FormError message={errors.date?.message} /></div><div className="space-y-2"><Label htmlFor="transaction-time">{uiText.transactions.fieldTime}</Label><Input id="transaction-time" type="time" className="h-11 sm:h-9" disabled={isView} aria-invalid={!!errors.time} {...form.register("time")} /><FormError message={errors.time?.message} /></div>{transactionType === undefined && <div className="space-y-2"><Label>{uiText.transactions.fieldType}</Label><Controller control={form.control} name="type" render={({ field }) => <Select value={field.value} onValueChange={(value) => { field.onChange(value as TransactionType); setSelectedType(value as TransactionType); }} disabled={isView}><SelectTrigger className="h-11 w-full sm:h-9" aria-label={uiText.transactions.fieldType}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">{uiText.transactions.typeIncome}</SelectItem><SelectItem value="expense">{uiText.transactions.typeExpense}</SelectItem></SelectContent></Select>} /><FormError message={errors.type?.message} /></div>}<div className="space-y-2"><Label>{uiText.transactions.fieldCategory}</Label><Controller control={form.control} name="category" render={({ field }) => <Select value={field.value} onValueChange={field.onChange} disabled={isView}><SelectTrigger className="h-11 w-full sm:h-9" aria-label={uiText.transactions.fieldCategory} aria-invalid={!!errors.category}><SelectValue placeholder={uiText.transactions.fieldCategory} /></SelectTrigger><SelectContent>{visibleCategories.map((category) => <SelectItem key={category} value={category}>{categoryLabel(category)}</SelectItem>)}</SelectContent></Select>} /><FormError message={errors.category?.message} /></div><div className="space-y-2"><Label htmlFor="transaction-amount">{uiText.transactions.fieldAmount}</Label><Controller control={form.control} name="amount" render={({ field }) => <MoneyInput id="transaction-amount" value={field.value} onValueChange={field.onChange} currency="IDR" disabled={isView} className="h-11 sm:h-9" aria-invalid={!!errors.amount} />} /><FormError message={errors.amount?.message} /></div><div className="space-y-2"><Label htmlFor="transaction-description">{uiText.transactions.fieldDescription}</Label><Input id="transaction-description" className="h-11 sm:h-9" disabled={isView} aria-invalid={!!errors.description} {...form.register("description")} /><FormError message={errors.description?.message} /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="transaction-notes">{uiText.transactions.fieldNotes}</Label><Textarea id="transaction-notes" rows={3} className="min-h-11 sm:min-h-16" disabled={isView} aria-invalid={!!errors.notes} {...form.register("notes")} /><FormError message={errors.notes?.message} /></div></div></div><DialogFooter className="shrink-0 gap-2 border-t bg-card px-6 py-4">{submitError && <p className="w-full text-sm text-red-500" role="alert">{submitError}</p>}{isView ? <Button type="button" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => onOpenChange(false)}>{uiText.common.close}</Button> : <><Button type="button" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={() => onOpenChange(false)}>{uiText.common.cancel}</Button><Button type="submit" className="h-11 flex-1 sm:h-9 sm:flex-none">{uiText.common.save}</Button></>}</DialogFooter></form></DialogContent></Dialog>;
}
