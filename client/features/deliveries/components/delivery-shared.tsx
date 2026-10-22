"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function DeliveryFeedback() {
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  useEffect(() => {
    const show = (event: Event) => setFeedback((event as CustomEvent<{ message: string; error?: boolean }>).detail);
    window.addEventListener("delivery-feedback", show);
    return () => window.removeEventListener("delivery-feedback", show);
  }, []);
  return feedback ? <p role={feedback.error ? "alert" : "status"} className="rounded-lg border bg-card p-4 text-sm">{feedback.message}</p> : null;
}
export function deliveryNotice(message: string) { window.dispatchEvent(new CustomEvent("delivery-feedback", { detail: { message } })); }
export function DeliveryRequestState({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  return loading ? <p role="status" className="rounded-lg border p-6">Loading delivery data…</p> : error ? <div role="alert" className="space-y-3 rounded-lg border p-4"><p>{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div> : null;
}
export function DeliveryPagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => void }) {
  return <nav aria-label="Delivery pagination" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{total} results · Page {page} of {totalPages || 1}</p><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button></div></nav>;
}
