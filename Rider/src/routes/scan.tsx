import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CameraOff, Image as ImageIcon, Keyboard, Zap, ZapOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { riderApi } from "@/lib/rider-store";
import { PageHeader } from "@/components/rider/ui";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan Parcel QR — SURFERTrack Rider" },
      { name: "description", content: "Scan a parcel's QR code to pick it up." },
      { property: "og:title", content: "Scan Parcel QR — SURFERTrack Rider" },
      { property: "og:description", content: "Scan a parcel's QR code to pick it up." },
    ],
  }),
  component: ScanPage,
});

type Detector = { detect: (src: CanvasImageSource | ImageBitmap) => Promise<{ rawValue: string }[]> };
function makeDetector(): Detector | null {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
  return BD ? new BD({ formats: ["qr_code"] }) : null;
}

function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [camState, setCamState] = useState<"loading" | "on" | "denied">("loading");
  const [flash, setFlash] = useState(false);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);

  const handleCode = async (raw: string) => {
    if (busy.current) return;
    busy.current = true;
    const code = raw.match(/MM\d{9}/i)?.[0] ?? raw;
    const parcel = await riderApi.findParcel(code);
    if (parcel) {
      navigate({ to: "/parcel/$id", params: { id: parcel.id } });
    } else {
      toast.error(`Parcel "${code}" not found`);
      setTimeout(() => (busy.current = false), 1500);
    }
  };

  useEffect(() => {
    let raf = 0;
    let stopped = false;
    const detector = makeDetector();
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        setCamState("on");
        const loop = async () => {
          if (stopped) return;
          if (detector && videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const r = await detector.detect(videoRef.current);
              if (r[0]) await handleCode(r[0].rawValue);
            } catch {
              /* ignore */
            }
          }
          raf = window.setTimeout(loop, 400) as unknown as number;
        };
        loop();
      })
      .catch(() => setCamState("denied"));
    if (!navigator.mediaDevices) setCamState("denied");
    return () => {
      stopped = true;
      clearTimeout(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    try {
      await track?.applyConstraints({ advanced: [{ torch: !flash } as MediaTrackConstraintSet] });
      setFlash(!flash);
    } catch {
      toast("Flash isn't supported on this device");
    }
  };

  const onGallery = async (file?: File) => {
    if (!file) return;
    const detector = makeDetector();
    if (!detector) {
      toast("Image scanning isn't supported in this browser — enter the code instead");
      setShowManual(true);
      return;
    }
    const bmp = await createImageBitmap(file);
    const r = await detector.detect(bmp);
    if (r[0]) handleCode(r[0].rawValue);
    else toast.error("No QR code found in that image");
  };

  return (
    <div className="flex min-h-screen flex-col bg-scanner text-primary-foreground">
      <PageHeader
        title="Scan Parcel QR Code"
        dark
        right={
          <button onClick={toggleFlash} aria-label="Toggle flash">
            {flash ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </button>
        }
      />
      <p className="px-10 text-center text-sm opacity-80">Position the parcel's QR code inside the frame</p>

      <div className="relative mx-auto mt-5 h-[min(48vh,400px)] w-full overflow-hidden bg-navy">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover blur-[1.5px] [image-rendering:auto]" />
        {camState !== "on" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm opacity-90">
            {camState === "loading" ? (
              <p>Starting camera…</p>
            ) : (
              <>
                <CameraOff className="h-8 w-8" />
                <p>Camera unavailable. Allow camera access, pick a photo, or enter the tracking code.</p>
              </>
            )}
          </div>
        )}
        {/* corner guides */}
        {["left-[12%] top-[12%] border-l-4 border-t-4 rounded-tl-xl", "right-[12%] top-[12%] border-r-4 border-t-4 rounded-tr-xl", "left-[12%] bottom-[12%] border-l-4 border-b-4 rounded-bl-xl", "right-[12%] bottom-[12%] border-r-4 border-b-4 rounded-br-xl"].map((c) => (
          <span key={c} className={`absolute h-12 w-12 border-[#2990ff] drop-shadow-[0_0_5px_#298cff] ${c}`} />
        ))}
        <span className="absolute left-[10%] right-[10%] h-[3px] bg-[#52aaff] shadow-[0_0_12px_4px_#268cff] animate-scanline" />
      </div>

      {showManual ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCode(manual);
          }}
          className="mx-6 mt-6 flex gap-2"
        >
          <input
            autoFocus
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="e.g. MM250430001"
            className="flex-1 rounded-xl bg-card px-4 py-3 text-foreground outline-none"
          />
          <button className="rounded-xl bg-primary px-4 font-semibold">Find</button>
        </form>
      ) : (
        <button onClick={() => setShowManual(true)} className="mx-auto mt-6 flex items-center gap-2 text-sm opacity-80">
          <Keyboard className="h-4 w-4" /> Enter tracking code manually
        </button>
      )}

      <div className="mt-auto flex justify-around pb-10 pt-6">
        <button onClick={toggleFlash} className="flex flex-col items-center gap-2 text-sm">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-card text-navy">
            <Zap className="h-6 w-6" />
          </span>
          Flash
        </button>
        <label className="flex cursor-pointer flex-col items-center gap-2 text-sm">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-card text-navy">
            <ImageIcon className="h-6 w-6" />
          </span>
          Gallery
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onGallery(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}
