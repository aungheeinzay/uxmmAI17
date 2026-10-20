import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteRiderForm } from "@/features/riders/components/invite-rider-form";
import { useInviteRider } from "@/features/riders/hooks/use-invite-rider";
import { RiderActivationForm } from "@/features/auth/components/rider-activation-form";
import { useActivateRider } from "@/features/auth/hooks/use-activate-rider";
import { RoleGuard } from "@/features/auth/components/role-guard";
import { useLogin } from "@/features/auth/hooks/use-login";
import { useAuthStore } from "@/stores/auth.store";
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/operator/riders" }));
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const profile = (role: "SME" | "OPERATOR" | "RIDER") => ({ id: "550e8400-e29b-41d4-a716-446655440000", role, fullName: null, phone: null });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); window.history.replaceState(null, "", "/"); });
it.each([ ["SME", "/seller"], ["OPERATOR", "/operator"], ["RIDER", "/rider"] ] as const)("routes %s after trusted login", async (role, route) => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ success: true, data: { user: profile(role) } })));
 const { result } = renderHook(() => useLogin());
 await act(async () => result.current.login({ email: "person@example.com", password: "password" }));
 expect(replace).toHaveBeenCalledWith(route);
});
it.each(["SME", "RIDER", "OPERATOR"] as const)("verifies backend identity before rendering %s", async (role) => {
 useAuthStore.getState().setUser(profile("OPERATOR"));
 let finish!: (value: Response) => void;
 vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; })));
 render(<RoleGuard role="OPERATOR"><p>Private workspace</p></RoleGuard>);
 expect(screen.queryByText("Private workspace")).toBeNull();
 await act(async () => finish(reply({ success: true, data: { user: profile(role) } })));
 if (role === "OPERATOR") expect(await screen.findByText("Private workspace")).toBeTruthy();
 else { expect(screen.queryByText("Private workspace")).toBeNull(); expect(replace).toHaveBeenCalledWith(role === "SME" ? "/seller" : "/rider"); }
});
it("redirects anonymous visitors without showing children", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "UNAUTHORIZED" } }, 401)));
 render(<RoleGuard role="RIDER"><p>Private workspace</p></RoleGuard>);
 await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
 expect(screen.queryByText("Private workspace")).toBeNull();
});
it("validates invitation email and reports conflicts", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "RIDER_INVITATION_CONFLICT" } }, 409)));
 render(<InviteRiderForm />); const keyboard = userEvent.setup();
 await keyboard.click(screen.getByRole("button", { name: "Send invitation" }));
 expect(await screen.findByText("Enter a valid email address.")).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
 await keyboard.type(screen.getByLabelText("Rider email"), "rider@example.com");
 await keyboard.click(screen.getByRole("button", { name: "Send invitation" }));
 expect(await screen.findByText(/account or pending invitation already exists/)).toBeTruthy();
});
it("locks duplicate invitations and omits blank name and role", async () => {
 let finish!: (value: Response) => void;
 const mock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; })); vi.stubGlobal("fetch", mock);
 const { result } = renderHook(() => useInviteRider()); let first!: Promise<boolean>;
 act(() => { first = result.current.submit({ email: "rider@example.com", fullName: "" }); void result.current.submit({ email: "rider@example.com", fullName: "" }); });
 expect(mock).toHaveBeenCalledTimes(1); expect(result.current.isPending).toBe(true);
 expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ email: "rider@example.com" });
 await act(async () => { finish(reply({ success: true, data: { message: "Sent", invitation: { id: profile("RIDER").id, email: "rider@example.com", status: "pending", expiresAt: new Date().toISOString() } } })); await first; });
 expect(result.current.success).toBe(true);
});
it("rejects missing activation links", () => { render(<RiderActivationForm />); expect(screen.getByRole("alert").textContent).toContain("missing or invalid"); });
it("scrubs fragments and rejects mismatched confirmation", async () => {
 window.history.replaceState(null, "", "/activate-rider#token=" + "a".repeat(43)); vi.stubGlobal("fetch", vi.fn());
 render(<RiderActivationForm />); expect(window.location.hash).toBe(""); const keyboard = userEvent.setup();
 await keyboard.type(screen.getByLabelText("New password", { exact: true }), "password123");
 await keyboard.type(screen.getByLabelText("Confirm new password", { exact: true }), "different123");
 await keyboard.click(screen.getByRole("button", { name: "Activate Rider account" }));
 expect(await screen.findByText("Passwords do not match.")).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
});
it.each([200, 400])("handles activation response %s without automatic login", async (status) => {
 window.history.replaceState(null, "", "/activate-rider#token=" + "a".repeat(43));
 const mock = vi.fn().mockResolvedValue(reply(status === 200 ? { success: true, data: { message: "Activated" } } : { error: { code: "INVALID_INVITATION_TOKEN" } }, status)); vi.stubGlobal("fetch", mock);
 const { result } = renderHook(() => useActivateRider());
 await act(async () => { await Promise.all([result.current.submit("password123"), result.current.submit("password123")]); });
 expect(mock).toHaveBeenCalledTimes(1); expect(window.location.hash).toBe("");
 if (status === 200) { expect(result.current.status).toBe("success"); act(() => result.current.goToLogin()); expect(replace).toHaveBeenCalledWith("/login"); }
 else { expect(result.current.error).toContain("expired, or already used"); expect(result.current.linkStatus).toBe("invalid"); }
});
