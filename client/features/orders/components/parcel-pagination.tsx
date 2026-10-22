"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderList } from "../schemas/order-list.schema";

type ParcelPaginationProps = {
  pagination: OrderList["pagination"];
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function ParcelPagination({ pagination, onPageChange, disabled }: ParcelPaginationProps) {
  const { page, pageSize, total, totalPages } = pagination;
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const canGoBack = page > 1 && !disabled;
  const canGoForward = page < totalPages && !disabled;

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? "No parcels" : `Showing ${firstRow}–${lastRow} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoBack}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
        <span className="text-body-sm text-muted-foreground" aria-live="polite">
          Page {total === 0 ? 0 : page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoForward}
          aria-label="Next page"
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
