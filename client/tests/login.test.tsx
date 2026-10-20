import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/features/auth/components/login-form";
import { loginSchema } from "@/features/auth/schemas/auth.schema";
import { useAuthStore } from "@/stores/auth.store";
import { restoreCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useLogin } from "@/features/auth/hooks/use-login";
import { useLogout } from "@/features/auth/hooks/use-logout";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const user = { id: "550e8400-e29b-41d4-a716-446655440000", role: "SME" as const, fullName: "Test Seller", phone: null };
const credentials = { email: "seller@example.com", password: "correct-password" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const unauthorized = () => response({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
const success = () => response({ success: true, data: { user } });

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, status: "loading", revision: 0 });
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function showForm(loginResponse: () => Promise<Response>) {
  const fetchMock = vi.fn().mockImplementation((url: string) => url.endsWith("/me") ? Promise.resolve(unauthorized()) : loginResponse());
  vi.stubGlobal("fetch", fetchMock);
  render(<LoginForm />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false));
  return fetchMock;
}
async function fill() {
  const keyboard = userEvent.setup();
  await keyboard.type(screen.getByLabelText("Email", { exact: true }), credentials.email);
  await keyboard.type(screen.getByLabelText("Password", { exact: true }), credentials.password);
  return keyboard;
}

it("matches backend login validation, including short existing passwords", () => {
  expect(loginSchema.safeParse({ ...credentials, password: "x" }).success).toBe(true);
  expect(loginSchema.safeParse({ ...credentials, password: "" }).success).toBe(false);
  expect(loginSchema.safeParse({ ...credentials, password: "x".repeat(129) }).success).toBe(false);
  expect(loginSchema.safeParse({ ...credentials, email: "invalid" }).success).toBe(false);
});

it("shows errors on empty submission and supports keyboard password toggles", async () => {
  await showForm(async () => success());
  const keyboard = userEvent.setup();
  await keyboard.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
  expect(screen.getByText("Enter your password.")).toBeTruthy();
  screen.getByRole("button", { name: "Show password" }).focus();
  await keyboard.keyboard(" ");
  expect(screen.getByLabelText("Password", { exact: true }).getAttribute("type")).toBe("text");
});

it("retains email and distinguishes invalid credentials", async () => {
  await showForm(async () => response({ success: false, error: { code: "LOGIN_FAILED" } }, 401));
  const keyboard = await fill();
  await keyboard.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText(/email or password is incorrect/)).toBeTruthy();
  expect((screen.getByLabelText("Email", { exact: true }) as HTMLInputElement).value).toBe(credentials.email);
  expect(useAuthStore.getState().user).toBeNull();
});

it("offers resend when Express says the email is unverified", async () => {
  await showForm(async () => response({ success: false, error: { code: "EMAIL_NOT_VERIFIED" } }, 403));
  const keyboard = await fill();
  await keyboard.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("button", { name: "Send verification link" })).toBeTruthy();
  expect((screen.getByLabelText("Registration email") as HTMLInputElement).value).toBe(credentials.email);
});

it("shows a connection error without blaming credentials", async () => {
  await showForm(async () => { throw new TypeError("network"); });
  const keyboard = await fill();
  await keyboard.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText(/couldn’t reach the sign-in service/)).toBeTruthy();
  expect(screen.queryByText(/password is incorrect/)).toBeNull();
});

it("disables pending login, updates only UI identity, and navigates safely", async () => {
  let finish!: (value: Response) => void;
  const fetchMock = await showForm(() => new Promise((resolve) => { finish = resolve; }));
  const keyboard = await fill();
  await keyboard.click(screen.getByRole("button", { name: "Sign in" }));
  expect((screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finish(success()));
  expect(useAuthStore.getState().user).toEqual(user);
  expect(Object.keys(useAuthStore.getState())).not.toContain("accessToken");
  expect(replace).toHaveBeenCalledWith("/seller");
  expect(fetchMock).toHaveBeenCalledWith("/api/session/login", expect.objectContaining({ credentials: "same-origin", body: JSON.stringify(credentials) }));
});

it("locks simultaneous login hook submissions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => success()));
  const { result } = renderHook(() => useLogin());
  await act(async () => { await Promise.all([result.current.login(credentials), result.current.login(credentials)]); });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("restores identity on reload and clears stale identity on invalid session", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(async () => success()).mockImplementationOnce(async () => unauthorized()));
  await restoreCurrentUser();
  expect(useAuthStore.getState().status).toBe("authenticated");
  expect(useAuthStore.getState().user).toEqual(user);
  await restoreCurrentUser();
  expect(useAuthStore.getState().status).toBe("unauthenticated");
  expect(useAuthStore.getState().user).toBeNull();
});

it("ignores an old restoration result after an account change", async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
  const pending = restoreCurrentUser();
  useAuthStore.getState().clearUser();
  finish(success());
  await pending;
  expect(useAuthStore.getState().user).toBeNull();
});

it("clears UI identity after logout and preserves a retry on server failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(response({ success: true, data: { message: "Signed out" } })));
  useAuthStore.getState().setUser(user);
  const { result } = renderHook(() => useLogout());
  await act(async () => result.current.logout());
  expect(useAuthStore.getState().user).toBeNull();
  expect(result.current.error).toContain("retry");
  await act(async () => result.current.logout());
  expect(replace).toHaveBeenCalledWith("/login");
});

it("returns to an enabled sign-in form after logout without another session check", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: { message: "Signed out" } }));
  vi.stubGlobal("fetch", fetchMock);
  useAuthStore.getState().setUser(user);
  const { result } = renderHook(() => useLogout());
  await act(async () => result.current.logout());
  expect(replace).toHaveBeenCalledWith("/login");
  expect(result.current.isPending).toBe(false);
  render(<LoginForm />);
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/session/logout", expect.anything());
});

it("releases the login loading state when the form is reused after sign-out", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => success()));
  const { result } = renderHook(() => useLogin());
  await act(async () => result.current.login(credentials));
  expect(result.current.isPending).toBe(false);
  act(() => useAuthStore.getState().clearUser());
  await act(async () => result.current.login(credentials));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().user).toEqual(user);
});

it("does not reuse a stale restoration after the session changes", async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn()
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
    .mockResolvedValueOnce(unauthorized()));
  const oldRestoration = restoreCurrentUser();
  useAuthStore.getState().clearUser();
  await restoreCurrentUser();
  finish(success());
  await oldRestoration;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().status).toBe("unauthenticated");
});
