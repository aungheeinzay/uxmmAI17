"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { CheckCircle2, LoaderCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { verifyParcelScan, updateDelivery, deliveryError } from "../api/deliveries.api";
import { useDeliveryMutation } from "../hooks/use-deliveries";
import type { AssignmentDetail } from "../types/delivery.types";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCompleted: () => void };
type CameraState = "initializing" | "ready" | "error";

function scanError(error: unknown) {
  if (error instanceof ApiError && error.status === 400) return "That is not a supported SURFERTrack parcel QR or code.";
  if (error instanceof ApiError && error.status === 404) return "This parcel is not assigned to you or is no longer available.";
  return deliveryError(error);
}

export function ParcelScanDialog({ open, onOpenChange, onCompleted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("initializing");
  const [manualValue, setManualValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [success, setSuccess] = useState(false);
  const verificationLockRef = useRef(false);
  const handoff = useDeliveryMutation(updateDelivery);

  function stopCamera() {
    startRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (typeof MediaStream !== "undefined" && stream instanceof MediaStream) stream.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function cameraFailure(cause: unknown) {
    const name = cause instanceof DOMException ? cause.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Camera permission was denied. Allow camera access in your browser settings, then reopen the scanner.";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera detected. You can enter the parcel code manually.";
    if (name === "SecurityError" || name === "TypeError" || !window.isSecureContext) return "Camera access requires HTTPS or localhost. You can enter the parcel code manually.";
    return "Camera unavailable. Check that another application is not using it, or enter the parcel code manually.";
  }

  useEffect(() => {
    if (!open || assignment || success) return;
    let active = true;
    const startId = ++startRef.current;
    const reader = new BrowserQRCodeReader();
    const video = videoElement;
    if (!video) return;
    const start = async () => {
      try {
        setCameraState("initializing");
        setCameraError(null);
        if (!window.isSecureContext && window.location.hostname !== "localhost") throw new DOMException("Secure context required", "SecurityError");
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Camera API unavailable", "NotFoundError");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active || startRef.current !== startId) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        if (!active || startRef.current !== startId) return;
        setCameraState("ready");
        controlsRef.current = await reader.decodeFromVideoElement(video, (result) => {
          if (active && !verificationLockRef.current && result) void verify(result.getText());
        });
        if (!active || startRef.current !== startId) controlsRef.current.stop();
      } catch (cause) {
        if (active && startRef.current === startId) {
          setCameraState("error");
          setCameraError(cameraFailure(cause));
        }
      }
    };
    void start();
    return () => { active = false; stopCamera(); };
  }, [open, assignment, success, videoElement]); // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(value: string) {
    const qrData = value.trim();
    if (!qrData || verificationLockRef.current) return;
    verificationLockRef.current = true;
    stopCamera();
    setVerifying(true);
    setError(null);
    try {
      setAssignment(await verifyParcelScan({ qrData }));
    } catch (cause) {
      setError(scanError(cause));
    } finally {
      verificationLockRef.current = false;
      setVerifying(false);
    }
  }

  function close() {
    stopCamera();
    setAssignment(null);
    setManualValue("");
    setError(null);
    setCameraError(null);
    setSuccess(false);
    onOpenChange(false);
  }

  async function confirmHandoff() {
    if (!assignment) return;
    const result = await handoff.submit({ id: assignment.id, status: "IN_TRANSIT" });
    if (result) {
      setSuccess(true);
      onCompleted();
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => value ? onOpenChange(true) : close()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{success ? "Pickup confirmed" : assignment ? "Parcel found" : "Scan Parcel QR Code"}</DialogTitle>
        <DialogDescription>
          {success ? "The parcel is now marked In Transit." : assignment ? "Verify the parcel details, then confirm the physical handoff." : "Scan the genuine SME parcel label. Scanned URLs are never opened automatically."}
        </DialogDescription>

        {success ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto size-14 text-emerald-600" aria-hidden="true" />
            <p className="font-medium">Handoff successful</p>
            {assignment && <Link className="text-primary underline" href={`/rider/assignments/${assignment.id}`} onClick={close}>View My Deliveries</Link>}
          </div>
        ) : assignment ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="font-mono font-bold">{assignment.order.orderCode}</p>
              <p className="mt-2 font-medium">{assignment.order.recipientName}</p>
              <p className="text-muted-foreground">{assignment.order.phoneNumber}</p>
              <p className="mt-2">{assignment.order.deliveryAddress}, {assignment.order.township}</p>
              <p className="mt-2 text-muted-foreground">Status: <strong className="text-foreground">{assignment.order.status}</strong></p>
            </div>
            {assignment.order.status === "PICKED_UP" ? (
              <Button className="min-h-11 w-full" disabled={handoff.isPending} onClick={() => void confirmHandoff()}>
                {handoff.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                Confirm Parcel Handoff
              </Button>
            ) : (
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">This parcel is already {assignment.order.status}. Open the assignment for the current delivery actions.</p>
            )}
            {handoff.error && <p role="alert" className="text-sm text-destructive">{handoff.error}</p>}
            <Link className="block text-center text-sm text-primary underline" href={`/rider/assignments/${assignment.id}`} onClick={close}>View assignment details</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-950">
              <video ref={element => { videoRef.current = element; setVideoElement(element); }} className="size-full object-cover" muted autoPlay playsInline aria-label="QR scanner camera preview" />
              <span className="pointer-events-none absolute inset-12 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden="true" />
              <ScanLine className="pointer-events-none absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-white" aria-hidden="true" />
              {cameraState === "initializing" && <span className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-white">Initializing camera…</span>}
              {cameraState === "ready" && <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">Scanning QR code</span>}
            </div>
            {cameraError && <p role="alert" className="text-sm text-destructive">{cameraError}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {verifying && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Verifying assigned parcel…</p>}
            <div className="space-y-2 border-t pt-4">
              <label htmlFor="manual-parcel-code" className="text-sm font-medium">Manual parcel code fallback</label>
              <div className="flex gap-2">
                <Input id="manual-parcel-code" value={manualValue} onChange={event => setManualValue(event.target.value)} placeholder="PO… or QR identifier" disabled={verifying} />
                <Button type="button" variant="outline" disabled={verifying || !manualValue.trim()} onClick={() => void verify(manualValue)}>Verify</Button>
              </div>
            </div>
            <Button type="button" variant="outline" className="min-h-11 w-full" onClick={close}>Back to deliveries</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
