"use client";

import { useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { verifyEmail } from "../api/auth.api";

export function useVerifyEmail() {
  const token = useRef<string | null>(null);
  const locked = useRef(false);
  const [status, setStatus] = useState<"ready" | "pending" | "success" | "error">("ready");
  const [retryable, setRetryable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (locked.current) return;
    const value = token.current ?? new URLSearchParams(window.location.hash.slice(1)).get("token");
    // Keep the token only in memory, outside visible URLs and persistence.
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
      setError("This verification link is missing or invalid. Request a new link below.");
      setStatus("error");
      setRetryable(false);
      return;
    }
    token.current = value;
    locked.current = true;
    setStatus("pending");
    setError(null);
    try {
      await verifyEmail(token.current);
      token.current = null;
      setStatus("success");
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "INVALID_VERIFICATION_TOKEN") {
        token.current = null;
        setRetryable(false);
        setError("This link has expired, was already used, or was replaced by a newer link. If you already verified your email, sign in. Otherwise, request a new link below.");
      } else if (cause instanceof ApiError && cause.status === 429) {
        setError("Too many attempts. Please wait 15 minutes and try again.");
      } else {
        setError("We couldn’t confirm verification. Check your connection and try again. If verification already completed, you can sign in.");
      }
      setStatus("error");
      locked.current = false;
    }
  }

  return { status, error, verify, canVerify: status === "ready" || (status === "error" && retryable) };
}
