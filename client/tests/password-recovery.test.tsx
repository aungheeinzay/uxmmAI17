import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { useForgotPassword } from "@/features/auth/hooks/use-forgot-password";
import { useResetPassword } from "@/features/auth/hooks/use-reset-password";
import { forgotPasswordSchema, resetPasswordSchema } from "@/features/auth/schemas/auth.schema";
import { useAuthStore } from "@/stores/auth.store";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const token = "r".repeat(43);
const response = (status = 200, code?: string) => new Response(JSON.stringify(status === 200 ? { success: true, data: { message: "Accepted." } } : { success: false, error: { code, message: "private backend detail" } }), { status });
function openLink(fragment = `token=${token}`) { window.history.replaceState(null, "", `/reset-password#${fragment}`); }

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
  useAuthStore.getState().clearUser();
  window.history.replaceState(null, "", "/");
});

describe("recovery validation", () => {
  it("validates trimmed emails and backend-aligned password boundaries", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "bad" }).success).toBe(false);
    expect(forgotPasswordSchema.parse({ email: " seller@example.com " }).email).toBe("seller@example.com");
    for (const size of [0, 7, 129]) expect(resetPasswordSchema.safeParse({ newPassword: "x".repeat(size), confirmPassword: "x".repeat(size) }).success).toBe(false);
    for (const size of [8, 128]) expect(resetPasswordSchema.safeParse({ newPassword: "x".repeat(size), confirmPassword: "x".repeat(size) }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ newPassword: "password123", confirmPassword: "different" }).success).toBe(false);
  });
});

describe("forgot password", () => {
  it("shows field errors without making invalid requests", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ForgotPasswordForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["seller@example.com", "unknown@example.com"])("shows the same generic confirmation for %s", async (email) => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), email);
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/If an account exists for this email/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/auth/forgot-password", expect.objectContaining({ body: JSON.stringify({ email }), credentials: "omit" }));
    expect((screen.getByRole("button", { name: /Request again in/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("prevents pending and simultaneous duplicates", async () => {
    let finish!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useForgotPassword());
    let pending!: Promise<void>;
    act(() => { pending = result.current.submit("seller@example.com"); });
    expect(result.current.isPending).toBe(true);
    await act(async () => { await result.current.submit("seller@example.com"); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { finish(response()); await pending; });
    expect(result.current.isSuccess).toBe(true);
  });
  it.each([429, 500])("handles HTTP %i without exposing raw details", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(status, status === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR")));
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "seller@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(status === 429 ? /Too many requests/ : /couldn’t confirm your request/)).toBeTruthy();
    expect(screen.queryByText(/private backend detail/)).toBeNull();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("seller@example.com");
  });
  it("handles a network failure without claiming delivery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    const { result } = renderHook(() => useForgotPassword());
    await act(async () => result.current.submit("seller@example.com"));
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toContain("couldn’t confirm");
  });
});

describe("reset password", () => {
  it.each(["", "token=bad", `token=${token}&token=${token}`])("handles a missing or invalid link (%s)", (fragment) => {
    openLink(fragment);
    vi.stubGlobal("fetch", vi.fn());
    render(<ResetPasswordForm />);
    expect(screen.getByText(/link is missing or invalid/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Request a new reset link" }).getAttribute("href")).toBe("/forgot-password");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("captures a token once in StrictMode and removes it without rendering or persisting it", () => {
    openLink();
    render(<StrictMode><ResetPasswordForm /></StrictMode>);
    expect(screen.getByLabelText("New password", { exact: true })).toBeTruthy();
    expect(window.location.hash).toBe("");
    expect(document.body.innerHTML).not.toContain(token);
    expect(JSON.stringify(useAuthStore.getState())).not.toContain(token);
    expect(JSON.stringify(localStorage)).not.toContain(token);
    expect(JSON.stringify(sessionStorage)).not.toContain(token);
  });
  it("hydrates the reset page without exposing the token in server HTML", async () => {
    openLink();
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ResetPasswordForm />);
    expect(container.innerHTML).not.toContain(token);
    document.body.appendChild(container);
    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(container, <ResetPasswordForm />, { onRecoverableError: recoverable }); });
      expect(recoverable).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(window.location.hash).toBe("");
    } finally { await act(async () => root?.unmount()); container.remove(); consoleError.mockRestore(); }
  });
  it("shows password validation and keyboard-accessible visibility controls", async () => {
    openLink();
    vi.stubGlobal("fetch", vi.fn());
    render(<ResetPasswordForm />);
    const keyboard = userEvent.setup();
    await keyboard.type(screen.getByLabelText("New password", { exact: true }), "short");
    await keyboard.type(screen.getByLabelText("Confirm new password", { exact: true }), "different");
    await keyboard.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Use at least 8 characters.")).toBeTruthy();
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    screen.getByRole("button", { name: "Show new password" }).focus();
    await keyboard.keyboard(" ");
    expect(screen.getByLabelText("New password", { exact: true }).getAttribute("type")).toBe("text");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("submits only token/newPassword, locks duplicates and clears stale identity", async () => {
    openLink();
    let finish!: (r: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; })).mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.getState().setUser({ id: "550e8400-e29b-41d4-a716-446655440000", role: "SME", fullName: null, phone: null });
    render(<ResetPasswordForm />);
    const keyboard = userEvent.setup();
    await keyboard.type(screen.getByLabelText("New password", { exact: true }), "new-password");
    await keyboard.type(screen.getByLabelText("Confirm new password", { exact: true }), "new-password");
    await keyboard.click(screen.getByRole("button", { name: "Update password" }));
    expect((screen.getByRole("button", { name: "Updating password…" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByLabelText("New password", { exact: true }).closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/auth/reset-password", expect.objectContaining({ body: JSON.stringify({ token, newPassword: "new-password" }) }));
    await act(async () => finish(response()));
    expect(await screen.findByText(/Your password has been updated/)).toBeTruthy();
    expect(useAuthStore.getState().user).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/session/logout", expect.objectContaining({ credentials: "same-origin" }));
    await keyboard.click(screen.getByRole("button", { name: "Continue to sign in" }));
    expect(replace).toHaveBeenCalledWith("/login");
  });
  it("automatically navigates after showing successful reset feedback", async () => {
    vi.useFakeTimers();
    openLink();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => response()));
    const { result } = renderHook(() => useResetPassword());
    await act(async () => result.current.submit("new-password"));
    expect(result.current.status).toBe("success");
    await act(async () => vi.advanceTimersByTime(2500));
    expect(replace).toHaveBeenCalledWith("/login");
  });
  it("treats invalid, expired and used reset tokens as terminal and offers recovery", async () => {
    openLink();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, "INVALID_RESET_TOKEN")));
    const { result } = renderHook(() => useResetPassword());
    await act(async () => result.current.submit("new-password"));
    expect(result.current.linkStatus).toBe("invalid");
    expect(result.current.error).toContain("expired, was already used");
    expect(replace).not.toHaveBeenCalled();
  });
  it("retains the in-memory token for a retry after network failure", async () => {
    openLink();
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockImplementation(async () => response());
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useResetPassword());
    await act(async () => result.current.submit("new-password"));
    expect(result.current.status).toBe("error");
    expect(result.current.linkStatus).toBe("ready");
    expect(result.current.error).toContain("try signing in with your new password");
    await act(async () => result.current.submit("new-password"));
    expect(result.current.status).toBe("success");
  });
});
