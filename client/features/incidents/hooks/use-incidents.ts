"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { ApiError } from "@/lib/api-client";
import { incidentError } from "../api/incidents.api";
import type { UserRole } from "@/features/auth/role-routes";

export function refreshIncidents() {
  window.dispatchEvent(new Event("incidents-changed"));
  // The incident flag is derived from incident records, so parcel and delivery views must refresh too.
  window.dispatchEvent(new Event("operator-parcels-changed"));
  window.dispatchEvent(new Event("deliveries-changed"));
}
export function useIncidentResource<T>(role: UserRole, key: string, load: (key: string) => Promise<T>) {
  const user = useAuthStore(state => state.user);
  const revision = useAuthStore(state => state.revision);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  const identity = JSON.stringify([role, key, user?.id, user?.role, revision, attempt]);
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener("incidents-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("incidents-changed", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (user?.role !== role) return;
    let active = true;
    void load(key).then(data => { if (active) setResult({ key: identity, data }); }).catch((error: unknown) => {
      if (!active) return;
      setResult({ key: identity, error: incidentError(error) });
      if (error instanceof ApiError && error.status === 401) useAuthStore.getState().clearUser();
    });
    return () => { active = false; };
  }, [identity, key, load, role, user?.role]);
  const current = result?.key === identity && user?.role === role ? result : undefined;
  return { data: current?.data, error: current?.error, isLoading: user?.role === role && !current, retry: () => setAttempt(value => value + 1) };
}
export function useIncidentMutation<I, O>(mutate: (input: I) => Promise<O>) {
  const lock = useRef(false);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(input: I) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(undefined);
    const session = useAuthStore.getState();
    try {
      const data = await mutate(input);
      if (useAuthStore.getState().user?.id !== session.user?.id || useAuthStore.getState().revision !== session.revision) return;
      refreshIncidents(); return data;
    } catch (cause) {
      if (useAuthStore.getState().user?.id !== session.user?.id || useAuthStore.getState().revision !== session.revision) return;
      const message = incidentError(cause); setError(message);
      window.dispatchEvent(new CustomEvent("incident-feedback", { detail: { message, error: true } }));
      if (cause instanceof ApiError && cause.status === 401) useAuthStore.getState().clearUser();
    } finally { lock.current = false; setPending(false); }
  }
  return { submit, isPending, error };
}
