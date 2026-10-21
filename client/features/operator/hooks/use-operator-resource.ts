"use client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { operatorOrdersError } from "../api/operator-orders.api";

export function useOperatorResource<T>(resourceKey: string, load: (key: string) => Promise<T>) {
  const userId = useAuthStore(state => state.user?.id);
  const role = useAuthStore(state => state.user?.role);
  const revision = useAuthStore(state => state.revision);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([resourceKey, userId, role, revision, attempt]);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    if (!userId || role !== "OPERATOR") return;
    let active = true;
    void load(resourceKey).then(data => { if (active) setResult({ key, data }); }).catch((error: unknown) => {
      if (!active) return;
      setResult({ key, error: operatorOrdersError(error) });
      if (error instanceof ApiError && error.status === 401) useAuthStore.getState().clearUser();
    });
    return () => { active = false; };
  }, [key, resourceKey, userId, role, load]);
  const current = result?.key === key && userId && role === "OPERATOR" ? result : null;
  return { data: current?.data, error: current?.error,
    isLoading: !!userId && role === "OPERATOR" && !current,
    retry: () => setAttempt(value => value + 1) };
}
