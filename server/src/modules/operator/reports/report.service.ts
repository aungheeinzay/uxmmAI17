import { AppError } from "../../../lib/errors/app-error";
import type { Role, OrderStatus } from "../../../generated/prisma/enums";
import * as repository from "./report.repository";
import type { ReportQuery } from "./report.validation";

type Actor = { id: string; role: Role };
const TIMEZONE = "Asia/Yangon";
const STATUS_VALUES = ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"] as const;
type Bucket = "day" | "week" | "month";

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(calendar.getTime()) || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new AppError(400, "VALIDATION_ERROR", "Dates must be valid calendar dates.");
  return new Date(calendar.getTime() - (6 * 60 + 30) * 60 * 1000);
}
function dateOnly(value: Date) {
  const shifted = new Date(value.getTime() + (6 * 60 + 30) * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
function localKey(value: Date, granularity: Bucket) {
  const shifted = new Date(value.getTime() + (6 * 60 + 30) * 60 * 1000);
  if (granularity === "month") return shifted.toISOString().slice(0, 7);
  if (granularity === "day") return shifted.toISOString().slice(0, 10);
  const day = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
function addLocalDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}
function bucketKeys(start: string, end: string, granularity: Bucket) {
  const keys: string[] = [];
  if (granularity === "month") {
    const [year, month] = start.split("-").map(Number);
    const [endYear, endMonth] = end.split("-").map(Number);
    for (let y = year, m = month; y < endYear || (y === endYear && m <= endMonth); m += 1) {
      if (m === 13) { y += 1; m = 1; }
      keys.push(`${y}-${String(m).padStart(2, "0")}`);
    }
    return keys;
  }
  let cursor = granularity === "week" ? addLocalDays(start, -((new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7)) : start;
  while (cursor < end) { keys.push(cursor); cursor = addLocalDays(cursor, granularity === "week" ? 7 : 1); }
  return keys;
}

export async function overview(actor: Actor, query: ReportQuery) {
  if (actor.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may view reports.");
  const start = localDate(query.startDate);
  const endDate = localDate(query.endDate);
  const end = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  if (end <= start) throw new AppError(400, "VALIDATION_ERROR", "End date must be on or after start date.");
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) throw new AppError(400, "VALIDATION_ERROR", "Report ranges cannot exceed 366 days.");
  const membership = await repository.findOperatorMembership(actor.id);
  if (!membership || membership.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may view reports.");
  if (!membership.providerId) throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured.");
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  const granularity = query.granularity ?? (days <= 31 ? "day" : days <= 180 ? "week" : "month");
  const [total, grouped, created, deliveredRows] = await repository.getProviderCohort(membership.providerId, start, end);
  const counts = Object.fromEntries(STATUS_VALUES.map(status => [status, 0])) as Record<OrderStatus, number>;
  for (const row of grouped) counts[row.status] = typeof row._count === "object" && row._count ? row._count._all ?? 0 : 0;
  const volumeMap = new Map<string, number>();
  for (const row of created) { const key = localKey(row.createdAt, granularity); volumeMap.set(key, (volumeMap.get(key) ?? 0) + 1); }
  const startKey = query.startDate;
  const endKey = dateOnly(endDate);
  const volume = bucketKeys(startKey, addLocalDays(endKey, 1), granularity).map(date => ({ date, count: volumeMap.get(date) ?? 0 }));
  const durations: number[] = [];
  for (const row of deliveredRows) {
    const pickup = row.statusEvents.find(event => event.status === "PICKED_UP");
    const delivered = [...row.statusEvents].reverse().find(event => event.status === "DELIVERED");
    if (pickup && delivered && delivered.createdAt > pickup.createdAt) durations.push((delivered.createdAt.getTime() - pickup.createdAt.getTime()) / 3600000);
  }
  const completed = counts.DELIVERED + counts.FAILED;
  return {
    period: { start: query.startDate, end: query.endDate, timezone: TIMEZONE },
    metrics: { totalParcels: total, delivered: counts.DELIVERED, failed: counts.FAILED, successRate: completed ? Math.round((counts.DELIVERED / completed) * 10000) / 100 : null, averageDeliveryHours: durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 100) / 100 : null },
    volume,
    statusBreakdown: STATUS_VALUES.map(status => ({ status, count: counts[status] })),
    granularity,
    unavailableMetrics: { averageDeliveryHours: durations.length ? null : "No valid PICKED_UP and DELIVERED history pairs were found." },
  };
}
