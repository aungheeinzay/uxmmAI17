"use client";
import { useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { updateProfile, profileErrorMessage } from "../api/profile.api";
import type { ProfileFormValues } from "../schemas/profile.schema";
export function useUpdateProfile() {
 const locked = useRef(false);
 const [isPending, setIsPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState(false);
 async function submit(values: ProfileFormValues) {
  if (locked.current) return null;
  const identity = useAuthStore.getState();
  locked.current = true; setIsPending(true); setError(null); setSuccess(false);
  try {
   const user = await updateProfile(values);
   const current = useAuthStore.getState();
   if (current.revision !== identity.revision || current.user?.id !== user.id) return null;
   current.setUser(user); setSuccess(true); return user;
  } catch (cause) { setError(profileErrorMessage(cause)); return null; }
  finally { locked.current = false; setIsPending(false); }
 }
 return { submit, isPending, error, success };
}
