"use client";

import { useEffect, useRef, useState } from "react";
import { passwordRecoveryErrorMessage, requestPasswordReset } from "../api/auth.api";

export function useForgotPassword() {
  const locked = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setTimeout(() => setCooldown((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(email: string) {
    if (locked.current || cooldown > 0) return;
    locked.current = true;
    setIsPending(true);
    setError(null);
    setIsSuccess(false);
    try {
      await requestPasswordReset(email);
      setIsSuccess(true);
      setCooldown(60);
    } catch (cause) { setError(passwordRecoveryErrorMessage(cause)); }
    finally { locked.current = false; setIsPending(false); }
  }

  return { submit, isPending, isSuccess, cooldown, error };
}
