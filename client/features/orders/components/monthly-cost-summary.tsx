"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MonthlyCostEntry = {
  /** Calendar month in UTC, for example "2026-10". */
  month: string;
  /** Total cost for the month. */
  cost: number;
};

type MonthlyCostSummaryProps = {
  /** Month over month totals, oldest first. */
  entries: MonthlyCostEntry[];
  /** Currency code shown next to every amount. */
  currency?: string;
  className?: string;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const label = MONTH_LABELS[Number(monthNumber) - 1];
  return label && year ? `${label} ${year}` : month;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${Math.abs(value).toFixed(1)}%`;
}

function changeBetween(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function MonthlyCostSummary({
  entries,
  currency = "MMK",
  className,
}: MonthlyCostSummaryProps) {
  const previousEntry = entries.length > 1 ? entries[entries.length - 2] : null;
  const currentEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  const headlineChange =
    previousEntry && currentEntry ? changeBetween(currentEntry.cost, previousEntry.cost) : null;

  const rows = entries.map((entry, index) => {
    const prior = entries[index - 1];
    return {
      ...entry,
      label: formatMonthLabel(entry.month),
      change: prior ? changeBetween(entry.cost, prior.cost) : null,
    };
  });

  const total = entries.reduce((sum, entry) => sum + entry.cost, 0);
  const average = entries.length > 0 ? total / entries.length : 0;
  const hasParcels = entries.some((entry) => entry.cost > 0);

  const comparison = headlineChange === null
    ? { label: "No change vs last month", tone: "text-muted-foreground", Icon: Minus }
    : headlineChange < 0
      ? { label: `${formatPercent(headlineChange)} lower vs last month`, tone: "text-success", Icon: TrendingDown }
      : { label: `${formatPercent(headlineChange)} higher vs last month`, tone: "text-warning", Icon: TrendingUp };

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="gap-6 border-border bg-card px-6 py-6 shadow-card [--radius-card:20px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2
              id="monthly-cost-summary-heading"
              className="text-heading-3 font-bold tracking-tight text-foreground"
            >
              Monthly delivery cost summary
            </h2>
            <p className="text-body-md text-muted-foreground">
              Compare month-over-month delivery value, broken down by month.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-body-sm text-muted-foreground">Previous month</p>
            <p className="mt-2 text-heading-3 font-bold tabular-nums text-foreground">
              {previousEntry ? `${formatAmount(previousEntry.cost)} ${currency}` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-brand/30 bg-brand-tint p-4">
            <p className="text-body-sm font-medium text-brand">This month</p>
            <p className="mt-2 text-heading-3 font-bold tabular-nums text-foreground">
              {currentEntry ? `${formatAmount(currentEntry.cost)} ${currency}` : "—"}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-4">
            <comparison.Icon aria-hidden="true" className={cn("size-4 shrink-0", comparison.tone)} />
            <p className={cn("text-body-md font-medium", comparison.tone)}>{comparison.label}</p>
          </div>
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-card [--radius-card:16px]">

        <CardContent className="px-0 py-0">
          {hasParcels ? (
            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[420px] border-collapse text-left text-body-md"
                aria-labelledby="monthly-cost-summary-heading"
              >
                <thead className="border-b border-border bg-muted/60 text-caption uppercase tracking-[0.08em] text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Month</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Monthly cost</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.month} className="transition-colors hover:bg-muted/40">
                      <th scope="row" className="px-5 py-3.5 font-medium text-foreground">
                        {row.label}
                      </th>
                      <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                        {formatAmount(row.cost)} {currency}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium">
                        {row.change === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={row.change < 0 ? "text-success" : "text-warning"}>
                            {row.change > 0 ? "+" : ""}
                            {row.change.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-body-sm text-muted-foreground">
              No parcels created in these months yet, so every total is zero.
            </p>
          )}
        </CardContent>

        <CardFooter className="flex-wrap items-center justify-between gap-4 px-5 py-3">
          <p className="text-body-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{entries.length}-month total</span>
            <span className="ml-2 tabular-nums">{formatAmount(total)} {currency}</span>
          </p>
          <p className="text-body-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Monthly average</span>
            <span className="ml-2 tabular-nums">{formatAmount(average)} {currency}</span>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
