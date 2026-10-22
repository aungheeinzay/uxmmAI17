"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { ApiError } from "@/lib/api-client";
import { getRiderProfile, riderProfileErrorMessage } from "../api/rider-profile.api";
import type { RiderProfile } from "../types/rider-profile.types";

export function useRiderProfile() {
  const user = useAuthStore(state => state.user);
  const revision = useAuthStore(state => state.revision);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: RiderProfile; error?: string }>();
  const identity = JSON.stringify([user?.id, user?.role, revision, attempt]);
  useEffect(() => {
    if (user?.role !== "RIDER") return;
    let active = true;
    void getRiderProfile().then(data => { if (active) setResult({ key: identity, data }); }).catch((error: unknown) => {
      if (!active) return;
      setResult({ key: identity, error: riderProfileErrorMessage(error) });
      if (error instanceof ApiError && error.status === 401) useAuthStore.getState().clearUser();
    });
    return () => { active = false; };
  }, [identity, user?.role]);
  const current = result?.key === identity && user?.role === "RIDER" ? result : undefined;
  return {
    profile: current?.data,
    error: current?.error,
    isLoading: user?.role === "RIDER" && !current,
    retry: () => setAttempt(value => value + 1),
  };
}
