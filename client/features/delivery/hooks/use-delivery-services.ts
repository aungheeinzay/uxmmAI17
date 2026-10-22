"use client";

import { useEffect, useState } from "react";
import { fetchDeliveryServices } from "../api/delivery.api";
import type { DeliveryServicesData } from "../schemas/delivery.schema";

export function useDeliveryServices(city: string | null) {
  const [data, setData] = useState<DeliveryServicesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!city) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchDeliveryServices(city)
      .then(result => {
        if (active) setData(result);
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : "FAILED");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [city]);

  return { data, isLoading, error };
}
