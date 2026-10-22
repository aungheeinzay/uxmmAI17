"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { getOrderStatus } from "../api/order.api";
import type { OrderStatusView } from "../schemas/order-status.schema";

const orderCodePattern = /^PO[0-9A-Fa-f]{16}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParcelStatusState = "idle" | "loading" | "success" | "error";

function messageFor(cause: unknown) {
  if (!(cause instanceof ApiError)) return "We couldn’t load tracking right now. Try again in a moment.";
  if (cause.status === 404) return "We couldn’t find a parcel with that code. Check the code on your receipt and try again.";
  if (cause.status === 400) return "That code isn’t a valid parcel or order code. Use the code from your receipt.";
  if (cause.status === 401) return "Your session has expired. Sign in again to track a parcel.";
  if (cause.status === 403) return "You don’t have access to this parcel.";
  if (cause.status === 0) return "We couldn’t reach the tracking service. Check your connection and try again.";
  return "Tracking is temporarily unavailable. Try again in a moment.";
}

export function useParcelStatus() {
  const [result, setResult] = useState<OrderStatusView | null>(null);
  const [state, setState] = useState<ParcelStatusState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function track(code: string) {
    const identifier = code.trim();
    if (!orderCodePattern.test(identifier) && !uuidPattern.test(identifier)) {
      setResult(null);
      setState("error");
      setError("Enter a valid parcel code, for example PO1B2C3D4E5F67890.");
      return;
    }
    setState("loading");
    setError(null);
    try {
      const status = await getOrderStatus(identifier);
      setResult(status);
      setState("success");
    } catch (cause) {
      setResult(null);
      setState("error");
      setError(messageFor(cause));
    }
  }

  function reset() {
    setResult(null);
    setState("idle");
    setError(null);
  }

  return { result, state, error, track, reset };
}
