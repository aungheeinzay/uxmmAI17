"use client";
import { useEffect, useState } from "react";
export function ReceiptFeedback() {
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  useEffect(() => {
    const show = (event: Event) => setFeedback((event as CustomEvent<{ message: string; error?: boolean }>).detail);
    window.addEventListener("operator-receipt-feedback", show);
    return () => window.removeEventListener("operator-receipt-feedback", show);
  }, []);
  return feedback ? <p role={feedback.error ? "alert" : "status"} className="rounded-lg border bg-card p-4 text-sm">{feedback.message}</p> : null;
}
