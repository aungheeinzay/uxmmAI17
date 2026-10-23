import Image from "next/image";

export function SessionSplash() {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-[#1B2F5A] px-6 py-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#3D51A3]/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full bg-[#3D51A3]/20 blur-3xl"
      />

      <div className="relative flex items-center rounded-2xl px-6 py-3 shadow-[0_16px_40px_rgba(9,20,45,0.35)]">
        <Image
          src="/images/logo_white.png"
          alt="SURFERTrack"
          width={1041}
          height={240}
          sizes="176px"
          priority
          className="h-auto w-44"
        />
      </div>

      <div className="relative flex flex-col items-center gap-4 text-center">
        <span aria-hidden="true" className="relative flex size-12 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-[3px] border-white/15" />
          <span className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-white motion-safe:animate-spin" />
          <span className="size-2.5 rounded-full bg-white/80" />
        </span>
        <div className="space-y-1.5">
          <p className="text-[15px] font-semibold text-white">Checking your session…</p>
          <p className="text-[12px] text-[#D1D5DB]">Securing your workspace.</p>
        </div>
      </div>
    </main>
  );
}
