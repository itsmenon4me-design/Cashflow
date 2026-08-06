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

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {uiText.common.showingRange
            .replace("{start}", String(startIndex))
            .replace("{end}", String(endIndex))
            .replace("{total}", String(totalItems))}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
            {uiText.common.prevPage}
          </Button>
          <span className="min-w-24 text-center text-sm text-muted-foreground">
            {uiText.common.pageOf
              .replace("{page}", String(page))
              .replace("{total}", String(totalPages))}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {uiText.common.nextPage}
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
