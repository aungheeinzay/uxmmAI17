"use client";

import { useEffect, useRef, useState } from "react";
import { resendVerification, resendVerificationErrorMessage } from "../api/auth.api";

export function useResendVerification() {
  const locked = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setTimeout(() => setCooldown((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend(email: string) {
    if (locked.current || cooldown > 0) return;
    locked.current = true;
    setIsPending(true);
    setMessage(null);
    setError(null);
    try {
      await resendVerification(email);
      // The API intentionally does not reveal account status, cooldown or SMTP failure.
      setMessage("If this email belongs to an unverified account, a verification link has been requested. Check your inbox and spam folder. If no email arrives, wait a minute and request again. Already verified? Sign in with your original password.");
      setCooldown(60);
    } catch (cause) {
      setError(resendVerificationErrorMessage(cause));
    } finally {
      locked.current = false;
      setIsPending(false);
    }
  }

  return { resend, isPending, cooldown, message, error };
}
