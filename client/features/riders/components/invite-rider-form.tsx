"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInviteRider } from "../hooks/use-invite-rider";
import { inviteRiderSchema, type InviteRiderValues } from "../schemas/rider.schema";
export function InviteRiderForm({ onInvited }: { onInvited?: () => void } = {}) {
 const invitation = useInviteRider();
 const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteRiderValues>({ resolver: zodResolver(inviteRiderSchema), defaultValues: { email: "", fullName: "" } });
 return <Card className="max-w-lg"><CardHeader><CardTitle><h2>Invite a Rider</h2></CardTitle></CardHeader><CardContent><form noValidate className="space-y-5" aria-busy={invitation.isPending} onSubmit={handleSubmit(async (values) => { if (await invitation.submit(values)) { reset(); onInvited?.(); } })}>
 {invitation.error && <Alert variant="destructive" role="alert"><AlertDescription>{invitation.error}</AlertDescription></Alert>}
 {invitation.success && <p role="status">Invitation sent. The Rider has 24 hours to activate their account.</p>}
 <div className="space-y-2"><Label htmlFor="rider-email">Rider email</Label><Input id="rider-email" type="email" autoComplete="email" required disabled={invitation.isPending} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />{errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}</div>
 <div className="space-y-2"><Label htmlFor="rider-name">Rider full name (optional)</Label><Input id="rider-name" autoComplete="name" disabled={invitation.isPending} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "name-error" : undefined} {...register("fullName")} />{errors.fullName && <p id="name-error" role="alert">{errors.fullName.message}</p>}</div>
 <Button type="submit" disabled={invitation.isPending}>{invitation.isPending ? "Sending invitation..." : "Send invitation"}</Button></form></CardContent></Card>;
}
