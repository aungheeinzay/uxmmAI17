"use client";

import { useEffect, useState } from "react";
import { fetchDeliveryServices } from "../api/delivery.api";
import type { DeliveryServicesData } from "../schemas/delivery.schema";

export function useDeliveryServices(city: string | null) {
  const [data, setData] = useState<DeliveryServicesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);

  useEffect(() => {
    if (!city) return;
    let active = true;
    fetchDeliveryServices(city)
      .then(result => {
        if (active) {
          setData(result);
          setError(null);
          setResolvedCity(city);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : "FAILED");
          setResolvedCity(city);
          setIsLoading(false);
        }
      })
      ;
    return () => {
      active = false;
    };
  }, [city]);

  return {
    data: city && resolvedCity === city ? data : null,
    isLoading: Boolean(city && resolvedCity !== city) || isLoading,
    error: city && resolvedCity === city ? error : null,
  };
}
