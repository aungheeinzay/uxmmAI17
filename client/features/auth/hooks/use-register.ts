"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registerAccount, registrationErrorMessage } from "../api/auth.api";
import type { RegisterRequest } from "../types/auth.types";
import { ApiError } from "@/lib/api-client";

export function useRegister() {
  const router = useRouter();
  const locked = useRef(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);

  async function register(input: RegisterRequest) {
    if (locked.current) return;
    locked.current = true;
    setStatus("pending");
    setError(null);
    setRecoveryEmail(null);
    try {
      await registerAccount(input);
      setStatus("success");
      router.replace("/verification-pending");
    } catch (cause) {
      if (cause instanceof ApiError && ((cause.status === 409 && cause.code === "REGISTRATION_FAILED") || cause.code === "EMAIL_DELIVERY_FAILED")) {
        setRecoveryEmail(input.email);
      }
      setError(registrationErrorMessage(cause));
      setStatus("error");
      locked.current = false;
    }
  }

  return { register, error, status, recoveryEmail, isPending: status === "pending" || status === "success" };
}
