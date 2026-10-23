import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperatorReports } from "@/features/operator/components/operator-reports";

const response = {
  success: true,
  data: {
    period: { start: "2026-10-01", end: "2026-10-30", timezone: "Asia/Yangon" },
    metrics: { totalParcels: 5, delivered: 2, failed: 1, successRate: 66.67, averageDeliveryHours: 24 },
    volume: [{ date: "2026-10-01", count: 5 }],
    statusBreakdown: ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"].map(status => ({ status, count: status === "DELIVERED" ? 2 : status === "FAILED" ? 1 : 0 })),
    granularity: "day",
    unavailableMetrics: { averageDeliveryHours: null },
  },
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("renders provider analytics returned by the API and refetches on a preset", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  render(<OperatorReports />);
  expect(await screen.findByText("Delivery Analytics")).toBeTruthy();
  expect(screen.getByText("66.67%")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(fetcher.mock.calls.length).toBeGreaterThan(1);
});

it("shows an actionable error state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 503 })));
  render(<OperatorReports />);
  expect(await screen.findByText("Reports unavailable")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});
