"use client";

import { roleRoutes } from "../role-routes";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { loginAccount, loginErrorMessage } from "../api/auth.api";
import type { LoginFormValues } from "../schemas/auth.schema";

export function useLogin() {
  const router = useRouter();
  const locked = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function login(values: LoginFormValues) {
    if (locked.current) return;
    locked.current = true;
    setIsPending(true);
    setError(null);
    setUnverifiedEmail(null);
    const revision = useAuthStore.getState().begin();
    try {
      const user = await loginAccount(values);
      if (useAuthStore.getState().revision !== revision) return;
      useAuthStore.getState().setUser(user);
      router.replace(roleRoutes[user.role]);
    } catch (cause) {
      if (useAuthStore.getState().revision === revision) useAuthStore.getState().clearUser();
      setError(loginErrorMessage(cause));
      if (cause instanceof ApiError && cause.code === "EMAIL_NOT_VERIFIED") setUnverifiedEmail(values.email);
    } finally {
      locked.current = false;
      setIsPending(false);
    }
  }

  return { login, isPending, error, unverifiedEmail };
}
