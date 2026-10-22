"use client";
import { useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { updateRiderProfile, riderProfileErrorMessage } from "../api/rider-profile.api";
import type { RiderProfileFormValues } from "../schemas/rider-profile.schema";
import type { RiderProfile } from "../types/rider-profile.types";

export function useSaveRiderProfile() {
  const locked = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(values: RiderProfileFormValues): Promise<RiderProfile | null> {
    if (locked.current) return null;
    locked.current = true;
    setIsPending(true);
    setError(undefined);
    const session = useAuthStore.getState();
    try {
      const profile = await updateRiderProfile(values);
      const current = useAuthStore.getState();
      if (current.user?.id !== session.user?.id || current.revision !== session.revision) return null;
      if (current.user) current.setUser({ ...current.user, fullName: profile.fullName, phone: profile.phone });
      return profile;
    } catch (cause) {
      if (useAuthStore.getState().revision !== session.revision) return null;
      setError(riderProfileErrorMessage(cause));
      return null;
    } finally {
      locked.current = false;
      setIsPending(false);
    }
  }
  return { submit, isPending, error, clearError: () => setError(undefined) };
}
