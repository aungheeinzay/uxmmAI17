import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import RegisterPage from "@/app/(auth)/register/page";
import { RegisterForm } from "@/features/auth/components/register-form";
import { useRegister } from "@/features/auth/hooks/use-register";
import { registerSchema } from "@/features/auth/schemas/auth.schema";
import { registerAccount, registrationErrorMessage } from "@/features/auth/api/auth.api";
import { ApiError } from "@/lib/api-client";
import { ResendVerificationForm } from "@/features/auth/components/resend-verification-form";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const values = { email: "seller@example.com", password: "password123", confirmPassword: "password123" };
const success = { success: true, data: { confirmationRequired: true, message: "Check your email." } };
function response(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("registration validation", () => {
  it.each([
    { email: "", password: "", confirmPassword: "" },
    { ...values, email: "invalid" },
    { ...values, password: "short" },
    { ...values, password: "x".repeat(129) },
    { ...values, confirmPassword: "different" },
  ])("rejects invalid fields %#", (input) => expect(registerSchema.safeParse(input).success).toBe(false));
  it("trims email and accepts backend password boundaries", () => {
    expect(registerSchema.parse({ ...values, email: " seller@example.com " }).email).toBe(values.email);
    for (const length of [8, 128]) expect(registerSchema.safeParse({ ...values, password: "x".repeat(length), confirmPassword: "x".repeat(length) }).success).toBe(true);
  });
});

describe("registration transport", () => {
  it("sends only credentials to port 4000 without cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(success));
    vi.stubGlobal("fetch", fetchMock);
    expect(await registerAccount(values)).toEqual(success);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/auth/register", expect.objectContaining({ body: JSON.stringify({ email: values.email, password: values.password }), credentials: "omit" }));
  });
  it.each([400, 409, 429, 500, 502, 503])("handles HTTP %i safely", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: false, error: { code: "INTERNAL_ERROR", message: "private database details" } }, status)));
    await expect(registerAccount(values)).rejects.toBeInstanceOf(ApiError);
    expect(registrationErrorMessage(new ApiError(status, "INTERNAL_ERROR"))).not.toContain("private");
  });
  it("explains account creation on email failure", () => {
    expect(registrationErrorMessage(new ApiError(503, "EMAIL_DELIVERY_FAILED"))).toContain("Your account was created");
  });
  it("handles network failure and rejects malformed success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(registerAccount(values)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: true, data: {} })));
    await expect(registerAccount(values)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("distinguishes timeout from connection failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
    await expect(registerAccount(values)).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
  });
  it("identifies invalid API configuration without sending credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "not-a-url");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(registerAccount(values)).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    [409, "REGISTRATION_FAILED", "An account with this email already exists"],
    [0, "REQUEST_TIMEOUT", "server took too long"],
    [0, "OFFLINE", "appear to be offline"],
    [0, "NETWORK_ERROR", "couldn’t connect"],
    [500, "INTERNAL_ERROR", "temporarily unavailable"],
  ])("gives actionable feedback for %s / %s", (status, code, message) => {
    expect(registrationErrorMessage(new ApiError(status as number, code as string))).toContain(message);
  });
});

describe("registration interaction", () => {
  it("lets an existing account request a new link without resending its password", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: false, error: { code: "REGISTRATION_FAILED" } }, 409))
      .mockResolvedValueOnce(response({ success: true, data: { message: "If unverified, sent." } }, 200));
    vi.stubGlobal("fetch", fetchMock);
    render(<RegisterForm />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create SME account" }));
    const email = await screen.findByLabelText("Registration email");
    expect((email as HTMLInputElement).value).toBe(values.email);
    await user.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(await screen.findByText(/a verification link has been requested/)).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith("http://localhost:4000/api/auth/resend-verification", expect.objectContaining({ body: JSON.stringify({ email: values.email }) }));
    expect((screen.getByRole("button", { name: /Request again in/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });
  it("offers resend recovery when email delivery failed after account creation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: false, error: { code: "EMAIL_DELIVERY_FAILED" } }, 503)));
    render(<RegisterForm />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create SME account" }));
    expect(await screen.findByRole("button", { name: "Send verification link" })).toBeTruthy();
  });
  it("validates resend email and displays rate limits without claiming delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: false, error: { code: "RATE_LIMITED" } }, 429));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResendVerificationForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Registration email"), values.email);
    await user.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(await screen.findByText(/Too many email requests/)).toBeTruthy();
    expect(screen.queryByText(/a verification link has been requested/)).toBeNull();
  });
  it("hydrates the server-rendered registration page without mismatches", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<RegisterPage />);
    document.body.appendChild(container);
    const recoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <RegisterPage />, { onRecoverableError: recoverableError });
      });
      expect(recoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      container.remove();
      consoleError.mockRestore();
    }
  });
  async function fillForm() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Work email"), values.email);
    await user.type(screen.getByLabelText("Password", { exact: true }), values.password);
    await user.type(screen.getByLabelText("Confirm password", { exact: true }), values.confirmPassword);
    return user;
  }
  it("shows accessible errors for empty submission", async () => {
    render(<RegisterForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create SME account" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(screen.getByText("Confirm your password.")).toBeTruthy();
    expect(screen.getByLabelText("Work email").getAttribute("aria-invalid")).toBe("true");
  });
  it("preserves values after a conflict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: false, error: { code: "REGISTRATION_FAILED" } }, 409)));
    render(<RegisterForm />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create SME account" }));
    expect(await screen.findByText(/An account with this email already exists/)).toBeTruthy();
    expect((screen.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe(values.password);
    expect(replace).not.toHaveBeenCalled();
  });
  it("disables pending submissions and navigates only after success", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RegisterForm />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create SME account" }));
    expect((screen.getByRole("button", { name: "Creating account…" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByLabelText("Work email").closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();
    await act(async () => finish(response(success)));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/verification-pending"));
  });
  it("locks simultaneous hook calls before React rerenders", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(success)));
    const { result } = renderHook(() => useRegister());
    await act(async () => { await Promise.all([result.current.register(values), result.current.register(values)]); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("supports keyboard focus and password visibility", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Work email"));
    const toggle = screen.getByRole("button", { name: "Show password" });
    toggle.focus();
    await user.keyboard(" ");
    expect(screen.getByLabelText("Password", { exact: true }).getAttribute("type")).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" }).getAttribute("aria-pressed")).toBe("true");
  });
});
