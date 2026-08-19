"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ACCOUNT_TYPE_OPTIONS, EMPTY_FORM_VALUES } from "@/features/accounts/constants";
import {
  accountFormSchema,
  type AccountFormValues,
} from "@/features/accounts/schema";
import { formatMoney } from "@/lib/format";
import { uiText } from "@/locales";
import type { AccountItem } from "@/services/account.service";
import { useDashboardCurrencyStore } from "@/stores/dashboardCurrency.store";

export type AccountFormMode = "create" | "edit" | "view";

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AccountFormMode;
  account: AccountItem | null;
  onSubmit: (values: AccountFormValues) => Promise<unknown> | unknown;
}

function toFormValues(account: AccountItem): AccountFormValues {
  return {
    name: account.name,
    accountType: ACCOUNT_TYPE_OPTIONS.some((option) => option.value === account.accountType)
      ? (account.accountType as AccountFormValues["accountType"])
      : "OTHER",
    currency: account.currency,
    openingBalance: account.openingBalance,
    description: account.description ?? "",
    isDefault: account.isDefault,
  };
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-red-500">{message}</p>;
}

export function AccountForm({
  open,
  onOpenChange,
  mode,
  account,
  onSubmit,
}: AccountFormProps) {
  const activeCurrency = useDashboardCurrencyStore((state) => state.currency);
  const isView = mode === "view";

  const title = isView
    ? uiText.accounts.viewTitle
    : mode === "edit"
      ? uiText.accounts.editTitle
      : uiText.accounts.addTitle;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  useEffect(() => {
    if (open) {
      if (account) {
        form.reset(toFormValues(account));
      } else {
        // For create mode, default the currency to the active dashboard currency
        form.reset({ ...EMPTY_FORM_VALUES, currency: activeCurrency });
      }
    }
  }, [open, account, form, activeCurrency]);

  const { errors } = form.formState;
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const watchedCurrency = form.watch("currency");

  const handleSubmit = async (values: AccountFormValues) => {
    setServerError(undefined);
    setIsSubmitting(true);
    try {
      // Ensure currency is bound to active dashboard currency (safety)
      values.currency = activeCurrency;
      // onSubmit is expected to throw on error or return truthy on success
      const res = await onSubmit(values);
      // If caller returned falsy, treat as failure
      if (res === false) {
        throw new Error("save_failed");
      }
      onOpenChange(false);
    } catch (err: unknown) {
      // Determine localized message
      type ApiErr = { status?: number; data?: { errorCode?: string; message?: string }; message?: string };
      const e = err as ApiErr;
      const conflict =
        e?.status === 409 ||
        e?.data?.errorCode === "ERR_CONFLICT" ||
        (typeof e?.message === "string" && e.message.includes("Account name")) ||
        (typeof e?.data?.message === "string" && e.data?.message?.includes("Account name"));
      if (conflict) {
        setServerError(uiText.accounts.duplicateNameError);
      } else {
        setServerError(uiText.accounts.saveFailed ?? uiText.common.unexpectedError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? uiText.accounts.subtitle
              : formatSummary(account)}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {serverError && (
              <div className="mb-2">
                <FormError message={serverError} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-name">{uiText.accounts.fieldName}</Label>
                <Input
                  id="account-name"
                  className="h-11 sm:h-9"
                  disabled={isView}
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                <FormError message={errors.name?.message} />
              </div>

              <div className="space-y-2">
                <Label>{uiText.accounts.fieldType}</Label>
                <Controller
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isView}
                    >
                      <SelectTrigger
                        className="h-11 w-full data-[size=default]:h-11 sm:h-9 sm:data-[size=default]:h-9"
                        aria-label={uiText.accounts.fieldType}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormError message={errors.accountType?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-currency">{uiText.accounts.fieldCurrency}</Label>
                <Input
                  id="account-currency"
                  className="h-11 uppercase sm:h-9"
                  maxLength={3}
                  disabled={isView || mode === 'create'}
                  aria-invalid={!!errors.currency}
                  {...form.register("currency")}
                />
                <FormError message={errors.currency?.message} />
              </div>

              {isView ? (
                <div className="space-y-2">
                  <Label>{uiText.accounts.balance}</Label>
                  <p className="text-lg font-semibold tracking-tight">
                    {account ? formatMoney(account.balance, activeCurrency) : formatMoney(0, activeCurrency)}
                  </p>
                </div>
              ) : mode === "create" ? (
                <div className="space-y-2">
                  <Label htmlFor="account-opening-balance">
                    {uiText.accounts.fieldOpeningBalance}
                  </Label>
                  <Controller
                    control={form.control}
                    name="openingBalance"
                    render={({ field }) => (
                      <MoneyInput
                        id="account-opening-balance"
                        value={field.value}
                        onValueChange={field.onChange}
                        currency={watchedCurrency}
                        className="h-11 sm:h-9"
                        aria-invalid={!!errors.openingBalance}
                      />
                    )}
                  />
                  <FormError message={errors.openingBalance?.message} />
                </div>
              ) : null}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="account-description">{uiText.accounts.fieldDescription}</Label>
                <Textarea
                  id="account-description"
                  rows={3}
                  className="min-h-11 sm:min-h-16"
                  disabled={isView}
                  aria-invalid={!!errors.description}
                  {...form.register("description")}
                />
                <FormError message={errors.description?.message} />
              </div>

              {mode === "create" && (
                <div className="space-y-2 sm:col-span-2">
                  <Controller
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="account-default"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <Label
                          htmlFor="account-default"
                          className="text-sm font-normal text-muted-foreground"
                        >
                          {uiText.accounts.fieldDefault}
                        </Label>
                      </div>
                    )}
                  />
                </div>
              )}
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
                <Button type="submit" className="h-11 flex-1 sm:h-9 sm:flex-none" disabled={isSubmitting}>
                  {isSubmitting ? uiText.settingsPage.saving ?? uiText.common.save : uiText.common.save}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatSummary(account: AccountItem | null): string {
  if (!account) {
    return "";
  }
  const typeLabel =
    ACCOUNT_TYPE_OPTIONS.find((option) => option.value === account.accountType)?.label ?? "";
  return `${typeLabel} · ${formatMoney(account.balance)}`;
}