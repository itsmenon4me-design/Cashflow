"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/features/transactions/constants";
import { uiText } from "@/locales";

interface TransactionPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TransactionPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TransactionPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{uiText.transactions.rowsPerPage}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger size="sm" className="w-[72px] rounded-xl" aria-label={uiText.transactions.rowsPerPage}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <p className="text-sm text-muted-foreground">
          {uiText.common.showingRange
            .replace("{start}", String(startIndex))
            .replace("{end}", String(endIndex))
            .replace("{total}", String(totalItems))}
        </p>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-11 rounded-xl px-0 sm:w-auto sm:px-2.5"
            aria-label={uiText.common.prevPage}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
            <span className="sr-only sm:not-sr-only">{uiText.common.prevPage}</span>
          </Button>
          <span className="min-w-0 flex-1 text-center text-sm text-muted-foreground sm:flex-none sm:whitespace-nowrap">
            <span className="sm:hidden">
              {page} / {totalPages}
            </span>
            <span className="sr-only sm:not-sr-only">
              {uiText.common.pageOf
                .replace("{page}", String(page))
                .replace("{total}", String(totalPages))}
            </span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-11 rounded-xl px-0 sm:w-auto sm:px-2.5"
            aria-label={uiText.common.nextPage}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <span className="sr-only sm:not-sr-only">{uiText.common.nextPage}</span>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
