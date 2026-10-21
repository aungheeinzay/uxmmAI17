"use client";

import { useEffect, useState } from "react";
import { getSmeDashboard } from "../api/sme-dashboard.api";
import type { SmeDashboard } from "../schemas/sme-dashboard.schema";

export function useSmeDashboard() {
  const [dashboard, setDashboard] = useState<SmeDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void getSmeDashboard().then((result) => {
      if (!active) return;
      setDashboard(result);
      setHasError(false);
    }).catch(() => {
      if (active) setHasError(true);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  function refresh() {
    setHasError(false);
    setIsLoading(true);
    setAttempt((current) => current + 1);
  }

  return { dashboard, isLoading, hasError, refresh };
}