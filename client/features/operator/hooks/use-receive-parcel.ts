"use client";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { receiveParcel, receiveParcelError } from "../api/operator-orders.api";

export function useReceiveParcel() {
  const locked = useRef(false);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<Awaited<ReturnType<typeof receiveParcel>>>();
  async function receive(id: string) {
    if (locked.current) return;
    const session = useAuthStore.getState();
    if (session.user?.role !== "OPERATOR") return;
    locked.current = true;
    setPending(true); setError(undefined); setData(undefined);
    try {
      const result = await receiveParcel(id);
      if (useAuthStore.getState().revision !== session.revision || useAuthStore.getState().user?.id !== session.user.id) return;
      setData(result);
      window.dispatchEvent(new CustomEvent("operator-receipt-feedback", { detail: { message: `Receipt confirmed for ${result.orderCode}. Current status: ${result.status}.` } }));
      window.dispatchEvent(new Event("operator-parcels-changed"));
      return result;
    } catch (cause) {
      if (useAuthStore.getState().revision !== session.revision) return;
      setError(receiveParcelError(cause));
      window.dispatchEvent(new CustomEvent("operator-receipt-feedback", { detail: { message: receiveParcelError(cause), error: true } }));
      if (cause instanceof ApiError && cause.status === 409) window.dispatchEvent(new Event("operator-parcels-changed"));
      if (cause instanceof ApiError && cause.status === 401) useAuthStore.getState().clearUser();
    } finally { locked.current = false; setPending(false); }
  }
  return { receive, isPending, error, data };
}
