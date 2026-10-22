"use client";
import { useRef, useState } from "react";
import { inviteRider, riderErrorMessage } from "../api/rider.api";
import type { InviteRiderValues } from "../schemas/rider.schema";
export function useInviteRider() {
 const locked = useRef(false);
 const [isPending, setIsPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState(false);
 async function submit(values: InviteRiderValues) {
  if (locked.current) return false;
  locked.current = true; setIsPending(true); setError(null); setSuccess(false);
  try { await inviteRider(values); setSuccess(true); window.dispatchEvent(new Event("operator-parcels-changed")); return true; }
  catch (cause) { setError(riderErrorMessage(cause)); return false; }
  finally { locked.current = false; setIsPending(false); }
 }
 return { submit, isPending, error, success };
}
