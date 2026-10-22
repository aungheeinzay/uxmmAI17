"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import type { AuthUser } from "@/features/auth/types/auth.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUpdateProfile } from "../hooks/use-update-profile";
import { profileFormSchema, type ProfileFormValues } from "../schemas/profile.schema";
export function ProfileSettingsForm() {
 const session = useCurrentUser();
 if (session.status === "loading") return <p role="status">Loading your profile...</p>;
 if (session.status === "error") return <div role="alert">Profile unavailable. <Button onClick={() => session.retry()}>Retry</Button></div>;
 if (!session.user) return <p role="alert">Sign in to view your profile.</p>;
 return <ProfileEditor key={session.user.id} user={session.user} />;
}
function ProfileEditor({ user }: { user: AuthUser }) {
 const update = useUpdateProfile();
 const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), defaultValues: { fullName: user.fullName ?? "", phone: user.phone ?? "" } });
 return <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><Card><CardHeader><CardTitle>Profile information</CardTitle><CardDescription>Keep your contact details up to date. Leave a field blank to clear it.</CardDescription></CardHeader><CardContent><form noValidate className="space-y-5" aria-busy={update.isPending} onSubmit={handleSubmit(async (values) => { const saved = await update.submit(values); if (saved) reset({ fullName: saved.fullName ?? "", phone: saved.phone ?? "" }); })}>
 {update.error && <Alert variant="destructive" role="alert"><AlertDescription>{update.error}</AlertDescription></Alert>}{update.success && <p role="status" className="text-sm">Profile saved successfully.</p>}
 <div className="space-y-2"><Label htmlFor="profile-name">Full name</Label><Input id="profile-name" autoComplete="name" disabled={update.isPending} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "profile-name-error" : undefined} {...register("fullName")} />{errors.fullName && <p id="profile-name-error" role="alert" className="text-sm text-destructive">{errors.fullName.message}</p>}</div>
 <div className="space-y-2"><Label htmlFor="profile-phone">Phone number</Label><Input id="profile-phone" type="tel" autoComplete="tel" disabled={update.isPending} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "profile-phone-error" : undefined} {...register("phone")} />{errors.phone && <p id="profile-phone-error" role="alert" className="text-sm text-destructive">{errors.phone.message}</p>}</div>
 <Button type="submit" disabled={update.isPending || !isDirty}>{update.isPending ? "Saving..." : "Save changes"}</Button></form></CardContent></Card><Card className="h-fit"><CardHeader><CardTitle>Account details</CardTitle><CardDescription>Managed by your account administrator.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label htmlFor="profile-email">Email address</Label><Input id="profile-email" readOnly value={user.email ?? "Unavailable"} /></div><div className="space-y-2"><Label htmlFor="profile-role">Current role</Label><Input id="profile-role" readOnly value={user.role} /></div><>{user.role === "OPERATOR" && <div className="space-y-2"><Label htmlFor="profile-provider">Delivery Provider</Label><Input id="profile-provider" readOnly value={user.provider?.name ?? "Your delivery provider has not been configured."} /></div>}</><div><p className="text-sm font-medium">Profile ID</p><p className="mt-1 break-all text-xs text-muted-foreground">{user.id}</p></div></CardContent></Card></div>;
}
