import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("verifies a fragment token once in StrictMode and removes it from the URL", async () => {
  const token = "a".repeat(43);
  window.history.replaceState(null, "", `/verify-email#token=${token}`);
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { message: "Verified" } })));
  vi.stubGlobal("fetch", fetchMock);
  render(<StrictMode><VerifyEmailPanel /></StrictMode>);
  expect(fetchMock).not.toHaveBeenCalled();
  await userEvent.dblClick(screen.getByRole("button", { name: "Verify my email" }));
  expect(await screen.findByText(/Your email is verified/)).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/auth/verify-email", expect.objectContaining({ body: JSON.stringify({ token }) }));
  expect(window.location.hash).toBe("");
});

it("offers resend for a missing token without a request", async () => {
  vi.stubGlobal("fetch", vi.fn());
  render(<VerifyEmailPanel />);
  await userEvent.click(screen.getByRole("button", { name: "Verify my email" }));
  expect(await screen.findByText(/link is missing or invalid/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send verification link" })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("handles expired tokens with resend recovery", async () => {
  window.history.replaceState(null, "", `/verify-email#token=${"b".repeat(43)}`);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "INVALID_VERIFICATION_TOKEN" } }), { status: 400 })));
  render(<VerifyEmailPanel />);
  await userEvent.click(screen.getByRole("button", { name: "Verify my email" }));
  expect(await screen.findByText(/expired, was already used/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send verification link" })).toBeTruthy();
});

it("can retry a connection failure using the token held in memory", async () => {
  window.history.replaceState(null, "", `/verify-email#token=${"c".repeat(43)}`);
  const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { message: "Verified" } })));
  vi.stubGlobal("fetch", fetchMock);
  render(<VerifyEmailPanel />);
  await userEvent.click(screen.getByRole("button", { name: "Verify my email" }));
  expect(await screen.findByText(/couldn’t confirm verification/)).toBeTruthy();
  expect(window.location.hash).toBe("");
  await userEvent.click(screen.getByRole("button", { name: "Verify my email" }));
  expect(await screen.findByText(/Your email is verified/)).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
