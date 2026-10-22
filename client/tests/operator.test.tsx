import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperatorLayout } from "@/features/operator/components/operator-layout";
import { OperatorDashboard } from "@/features/operator/components/operator-dashboard";
import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { useUpdateProfile } from "@/features/profile/hooks/use-update-profile";
import { profileUpdateSchema } from "@/features/profile/schemas/profile.schema";
import { useAuthStore } from "@/stores/auth.store";
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/operator/settings", useRouter: () => ({ replace }) }));
const user = { id: "550e8400-e29b-41d4-a716-446655440000", role: "OPERATOR" as const, fullName: "Original Name", phone: "+959123" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => { cleanup(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("renders all navigation destinations and highlights the active route", async () => {
 useAuthStore.getState().setUser(user); render(<OperatorLayout><p>Content</p></OperatorLayout>);
 expect(screen.getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
 expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
 expect(screen.getByRole("link", { name: "Rider Management" }).getAttribute("href")).toBe("/operator/riders");
 const keyboard = userEvent.setup(); await keyboard.click(screen.getByRole("button", { name: "Collapse sidebar" }));
 expect(screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded")).toBe("false");
});
it("opens the navigation drawer and closes it with Escape", async () => {
 useAuthStore.getState().setUser(user); render(<OperatorLayout><p>Content</p></OperatorLayout>);
 const keyboard = userEvent.setup(); await keyboard.click(screen.getByRole("button", { name: "Open navigation" }));
 expect(screen.getByRole("dialog")).toBeTruthy(); await keyboard.keyboard("{Escape}");
 await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("shows profile settings and reuses session logout", async () => {
 useAuthStore.getState().setUser(user); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ success: true })));
 render(<OperatorLayout><p>Content</p></OperatorLayout>); const keyboard = userEvent.setup();
 await keyboard.click(screen.getByRole("button", { name: "Open profile menu" }));
 expect(screen.getByRole("menuitem", { name: "Profile Settings" })).toBeTruthy();
 await keyboard.click(screen.getByRole("menuitem", { name: "Sign out" }));
 await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
 expect(useAuthStore.getState().user).toBeNull(); expect(fetch).toHaveBeenCalledWith("/api/session/logout", expect.anything());
});
it("shows the warehouse overview and functional quick action destinations without fabricated metrics", () => {
 render(<OperatorDashboard />); expect(screen.getByRole("heading", { name: "Warehouse overview" })).toBeTruthy();
 expect(screen.getByRole("link", { name: "Manage Riders" }).getAttribute("href")).toBe("/operator/riders");
 expect(screen.queryByText("Not connected")).toBeNull();
 expect(screen.getByRole("link", { name: "Open Warehouse Management" }).getAttribute("href")).toBe("/operator/warehouse");
});
it("loads profile, saves editable fields only and updates shared UI identity", async () => {
 useAuthStore.getState().setUser(user);
 const mock = vi.fn().mockResolvedValue(response({ success: true, data: { user: { ...user, fullName: "New Name", phone: "123456" } } })); vi.stubGlobal("fetch", mock);
 render(<ProfileSettingsForm />); const keyboard = userEvent.setup();
 expect((screen.getByLabelText("Email address") as HTMLInputElement).readOnly).toBe(true);
 expect((screen.getByLabelText("Current role") as HTMLInputElement).readOnly).toBe(true);
 await keyboard.clear(screen.getByLabelText("Full name")); await keyboard.type(screen.getByLabelText("Full name"), "New Name");
 await keyboard.clear(screen.getByLabelText("Phone number")); await keyboard.type(screen.getByLabelText("Phone number"), "123456");
 await keyboard.click(screen.getByRole("button", { name: "Save changes" }));
 expect(await screen.findByText("Profile saved successfully.")).toBeTruthy();
 expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ fullName: "New Name", phone: "123456" });
 expect(useAuthStore.getState().user?.fullName).toBe("New Name");
});
it("validates backend length limits and rejects privilege fields", async () => {
 expect(profileUpdateSchema.safeParse({ role: "RIDER" }).success).toBe(false);
 expect(profileUpdateSchema.safeParse({}).success).toBe(false);
 expect(profileUpdateSchema.safeParse({ fullName: null, phone: null }).success).toBe(true);
 useAuthStore.getState().setUser(user); vi.stubGlobal("fetch", vi.fn()); render(<ProfileSettingsForm />);
 const keyboard = userEvent.setup(); await keyboard.clear(screen.getByLabelText("Phone number")); await keyboard.type(screen.getByLabelText("Phone number"), "1".repeat(33));
 await keyboard.click(screen.getByRole("button", { name: "Save changes" })); expect(await screen.findByText("Use no more than 32 characters.")).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
});
it("locks duplicate profile submissions and normalizes empty fields to null", async () => {
 useAuthStore.getState().setUser(user); let finish!: (value: Response) => void;
 const mock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; })); vi.stubGlobal("fetch", mock);
 const { result } = renderHook(() => useUpdateProfile()); let pending!: Promise<unknown>;
 act(() => { pending = result.current.submit({ fullName: " ", phone: "" }); void result.current.submit({ fullName: " ", phone: "" }); });
 expect(result.current.isPending).toBe(true); expect(mock).toHaveBeenCalledTimes(1); expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ fullName: null, phone: null });
 await act(async () => { finish(response({ success: true, data: { user: { ...user, fullName: null, phone: null } } })); await pending; }); expect(result.current.success).toBe(true);
});
it("ignores a late update after logout", async () => {
 useAuthStore.getState().setUser(user); let finish!: (value: Response) => void;
 vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; })));
 const { result } = renderHook(() => useUpdateProfile()); let pending!: Promise<unknown>;
 act(() => { pending = result.current.submit({ fullName: "New", phone: "" }); }); act(() => useAuthStore.getState().clearUser());
 await act(async () => { finish(response({ success: true, data: { user } })); await pending; }); expect(useAuthStore.getState().user).toBeNull();
});
it("keeps form values and shows safe update failure feedback", async () => {
 useAuthStore.getState().setUser(user); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: "UNAUTHORIZED" } }, 401)));
 render(<ProfileSettingsForm />); const keyboard = userEvent.setup(); await keyboard.type(screen.getByLabelText("Full name"), " updated"); await keyboard.click(screen.getByRole("button", { name: "Save changes" }));
 expect(await screen.findByText(/Your session has expired/)).toBeTruthy(); expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Original Name updated");
});
