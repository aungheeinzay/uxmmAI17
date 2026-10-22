"use client";

import { useEffect, useState } from "react";
import { fetchDeliveryCities } from "../api/delivery.api";
import type { DeliveryCitiesData } from "../schemas/delivery.schema";

export function useDeliveryCities() {
  const [data, setData] = useState<DeliveryCitiesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDeliveryCities()
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
  }, []);

  return { data, isLoading, error };
}
