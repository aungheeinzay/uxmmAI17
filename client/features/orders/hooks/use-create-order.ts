"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder } from "../api/orders.api";

export function useCreateOrder() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: unknown) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createOrder(input);
      const data = result as { success?: boolean; data?: { id?: string; orderCode?: string } } | undefined;
      const id = data?.data?.id || data?.data?.orderCode;
      if (id) {
        router.push(`/seller/parcels/${id}`);
        return;
      }
      router.push("/seller/all-parcels");
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED");
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting, error };
}
