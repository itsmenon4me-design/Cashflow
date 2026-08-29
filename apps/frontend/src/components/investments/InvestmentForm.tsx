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
import { DecimalInput } from "@/components/ui/decimal-input";
import {
  EMPTY_FORM_VALUES,
  INVESTMENT_TYPE_OPTIONS,
} from "@/features/investments/constants";
import {
  investmentFormSchema,
  type InvestmentFormValues,
} from "@/features/investments/schema";
import { formatMoney } from "@/lib/format";
import { uiText } from "@/locales";
import type { InvestmentItem } from "@/services/investment.service";

export type InvestmentFormMode = "create" | "edit" | "view";

interface InvestmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InvestmentFormMode;
  item: InvestmentItem | null;
  onSubmit: (values: InvestmentFormValues) => void;
}

function toFormValues(item: InvestmentItem): InvestmentFormValues {
  return {
    investmentType: item.type,
    platform: item.platform,
    name: item.name,
    symbol: item.symbol ?? "",
    quantity: item.quantity,
    averageBuyPrice: item.avgPrice,
    currentPrice: item.currentPrice,
    invested: item.invested,
    purchaseDate: item.purchaseDate,
    notes: item.notes ?? "",
    status: item.status,
  };
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-red-500">{message}</p>;
}

export function InvestmentForm({
  open,
  onOpenChange,
  mode,
  item,
  onSubmit,
}: InvestmentFormProps) {
  const isView = mode === "view";
  const title = isView
    ? uiText.investments.viewTitle
    : mode === "edit"
      ? uiText.investments.editTitle
      : uiText.investments.addTitle;

  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(item ? toFormValues(item) : EMPTY_FORM_VALUES);
    }
  }, [open, item, form]);

  const { errors } = form.formState;

  const amountCurrency = "IDR";

  // NEW entries only: Modal Awal is auto-calculated as
  // Jumlah Unit × Harga Beli Rata-rata and shown read-only. Existing
  // investments keep their stored value untouched (no historical recalc).
  const isCreate = mode === "create";
  const watchedQuantity = form.watch("quantity");
  const watchedAvgPrice = form.watch("averageBuyPrice");
  const calculatedInvested =
    (Number(watchedQuantity) || 0) * (Number(watchedAvgPrice) || 0);

  useEffect(() => {
    if (!isCreate || !open) {
      return;
    }
    const current = form.getValues("invested");
    if (current !== calculatedInvested) {
      form.setValue("invested", calculatedInvested, {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  }, [isCreate, open, calculatedInvested, form]);

  const handleSubmit = (values: InvestmentFormValues) => {
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
              ? uiText.investments.subtitle
              : item
                ? `${item.name} · ${formatMoney(item.currentValue)}`
                : ""}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{uiText.investments.fieldType}</Label>
                <Controller
                  control={form.control}
                  name="investmentType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isView}>
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.investments.fieldType}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVESTMENT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>{uiText.investments.fieldStatus}</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isView}>
                      <SelectTrigger
                        className="h-10 w-full data-[size=default]:h-10 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.investments.fieldStatus}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">{uiText.investments.statusActive}</SelectItem>
                        <SelectItem value="SOLD">{uiText.investments.statusSold}</SelectItem>
                        <SelectItem value="CLOSED">{uiText.investments.statusClosed}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-name">{uiText.investments.fieldName}</Label>
                <Input
                  id="inv-name"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                <FormError message={errors.name?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-platform">{uiText.investments.fieldPlatform}</Label>
                <Input
                  id="inv-platform"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.platform}
                  {...form.register("platform")}
                />
                <FormError message={errors.platform?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-symbol">{uiText.investments.fieldSymbol}</Label>
                <Input id="inv-symbol" className="h-11 sm:h-9" disabled={isView} {...form.register("symbol")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-quantity">{uiText.investments.fieldQuantity}</Label>
                <Controller
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <DecimalInput
                      id="inv-quantity"
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView}
                      className="h-11 sm:h-9"
                      aria-invalid={!!errors.quantity}
                    />
                  )}
                />
                <FormError message={errors.quantity?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-avg">{uiText.investments.fieldAvgPrice}</Label>
                <Controller
                  control={form.control}
                  name="averageBuyPrice"
                  render={({ field }) => (
                    <DecimalInput
                      id="inv-avg"
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView}
                      className="h-11 sm:h-9"
                      aria-invalid={!!errors.averageBuyPrice}
                    />
                  )}
                />
                <FormError message={errors.averageBuyPrice?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-current">{uiText.investments.fieldCurrentPrice}</Label>
                <Controller
                  control={form.control}
                  name="currentPrice"
                  render={({ field }) => (
                    <DecimalInput
                      id="inv-current"
                      value={field.value ?? null}
                      onValueChange={field.onChange}
                      disabled={isView}
                      placeholder={uiText.investments.fieldCurrentPricePlaceholder}
                      className="h-11 sm:h-9"
                      aria-invalid={!!errors.currentPrice}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {uiText.investments.fieldCurrentPriceHint}
                </p>
                <FormError message={errors.currentPrice?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-invested">{uiText.investments.fieldInvested}</Label>
                {mode === "create" ? (
                  // New entries: read-only calculation result box.
                  <div
                    aria-live="polite"
                    className="flex h-11 items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 sm:h-9"
                  >
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(calculatedInvested)}
                    </span>
                    <span className="ml-2 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {amountCurrency}
                    </span>
                  </div>
                ) : (
                  <Controller
                    control={form.control}
                    name="invested"
                    render={({ field }) => (
                      <MoneyInput
                        id="inv-invested"
                        value={field.value}
                        onValueChange={field.onChange}
                        currency={amountCurrency}
                        disabled={isView}
                        className="h-11 sm:h-9"
                        aria-invalid={!!errors.invested}
                      />
                    )}
                  />
                )}
                {mode === "create" && (
                  <p className="text-xs text-muted-foreground">
                    {uiText.investments.investedAutoHint}
                  </p>
                )}
                <FormError message={errors.invested?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-date">{uiText.investments.fieldPurchaseDate}</Label>
                <Input
                  id="inv-date"
                  type="date"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.purchaseDate}
                  {...form.register("purchaseDate")}
                />
                <FormError message={errors.purchaseDate?.message} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="inv-notes">{uiText.investments.fieldNotes}</Label>
                <Textarea
                  id="inv-notes"
                  rows={3}
                  className="min-h-11 sm:min-h-16"
                  disabled={isView}
                  {...form.register("notes")}
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