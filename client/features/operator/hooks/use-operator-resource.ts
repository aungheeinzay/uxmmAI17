"use client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { operatorOrdersError } from "../api/operator-orders.api";

export function useOperatorResource<T>(resourceKey: string, load: (key: string) => Promise<T>, errorMessage: (error: unknown) => string = operatorOrdersError) {
  const userId = useAuthStore(state => state.user?.id);
  const role = useAuthStore(state => state.user?.role);
  const revision = useAuthStore(state => state.revision);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener("operator-parcels-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("operator-parcels-changed", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  const key = JSON.stringify([resourceKey, userId, role, revision, attempt]);
  const scope = JSON.stringify([userId, role, revision]);
  const [result, setResult] = useState<{ key: string; scope: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    if (!userId || role !== "OPERATOR") return;
    let active = true;
    void load(resourceKey).then(data => { if (active) setResult({ key, scope, data }); }).catch((error: unknown) => {
      if (!active) return;
      setResult({ key, scope, error: errorMessage(error) });
      if (error instanceof ApiError && error.status === 401) useAuthStore.getState().clearUser();
    });
    return () => { active = false; };
  }, [key, scope, resourceKey, userId, role, load, errorMessage]);
  const current = result?.key === key && userId && role === "OPERATOR" ? result : null;
  const previous = userId && role === "OPERATOR" && result?.scope === scope ? result : null;
  return { data: current ? current.data : previous?.data, error: current?.error,
    // Keep the current table visible while a new filter/page request is in flight.
    isRefetching: !!userId && role === "OPERATOR" && !current && !!previous,
    isLoading: !!userId && role === "OPERATOR" && !current && !previous,
    retry: () => setAttempt(value => value + 1) };
}
