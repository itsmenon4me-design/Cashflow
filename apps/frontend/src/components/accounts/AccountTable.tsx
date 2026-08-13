"use client";

import { AccountCard, AccountRowActions } from "@/components/accounts/AccountCard";
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
import { ACCOUNT_TYPE_OPTIONS } from "@/features/accounts/constants";
import { formatMoney } from "@/lib/format";
import { uiText } from "@/locales";
import type { AccountItem } from "@/services/account.service";

function typeInfo(type: string) {
  return (
    ACCOUNT_TYPE_OPTIONS.find((option) => option.value === type) ??
    ACCOUNT_TYPE_OPTIONS[ACCOUNT_TYPE_OPTIONS.length - 1]
  );
}

interface AccountTableProps {
  accounts: AccountItem[];
  loading?: boolean;
  onView: (account: AccountItem) => void;
  onEdit: (account: AccountItem) => void;
  onSetDefault: (account: AccountItem) => void;
  onDelete: (account: AccountItem) => void;
}

export function AccountTable({
  accounts,
  loading = false,
  onView,
  onEdit,
  onSetDefault,
  onDelete,
}: AccountTableProps) {
  if (loading) {
    return (
      <>
        <div className="hidden md:block">
          <TableSkeleton rows={6} columns={5} />
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
                <TableHead>{uiText.accounts.fieldName}</TableHead>
                <TableHead>{uiText.table.type}</TableHead>
                <TableHead className="text-right">{uiText.accounts.balance}</TableHead>
                <TableHead>{uiText.accounts.status}</TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const info = typeInfo(account.accountType);
                const TypeIcon = info.icon;
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                          style={
                            account.color
                              ? { backgroundColor: `${account.color}22`, color: account.color }
                              : undefined
                          }
                        >
                          <TypeIcon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{account.name}</span>
                          {account.isDefault && (
                            <span className="text-xs text-muted-foreground">
                              {uiText.accounts.default}
                            </span>
                          )}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg bg-muted">
                        {info.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(account.balance, account.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.isActive ? "success" : "neutral"}
                        className="rounded-lg"
                      >
                        {account.isActive ? uiText.accounts.active : uiText.accounts.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <AccountRowActions
                        account={account}
                        onView={onView}
                        onEdit={onEdit}
                        onSetDefault={onSetDefault}
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
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onView={onView}
            onEdit={onEdit}
            onSetDefault={onSetDefault}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}