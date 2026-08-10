import { type ReactNode } from "react";

export function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="device-frame-outer min-h-[100dvh] w-full flex items-stretch md:items-center justify-center md:py-8 print:py-0">
      {/* Slow glow orbs (desktop bg accent) — diffused, multi-hue "pigment mist" */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden md:block no-print">
        <div className="slow-glow absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
             style={{ background: "radial-gradient(circle, rgba(167,139,196,0.24), transparent 60%)" }} />
        <div className="slow-glow absolute left-1/4 bottom-0 h-[440px] w-[440px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(24,52,45,0.32), transparent 60%)", animationDelay: "-4s" }} />
        <div className="slow-glow absolute right-[8%] top-[8%] h-[360px] w-[360px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(231,166,184,0.22), transparent 60%)", animationDelay: "-8s" }} />
        <div className="slow-glow absolute right-[12%] bottom-[10%] h-[300px] w-[300px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(232,184,74,0.16), transparent 60%)", animationDelay: "-6s" }} />
      </div>

      <div
        className="device-bezel relative w-full md:w-[400px] md:h-[860px] md:rounded-[52px] md:p-[10px] md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] md:border md:border-black/60 md:bg-[#0a0508] print:!p-0 print:!shadow-none print:!border-0"
      >
        {/* Dynamic-island-ish */}
        <div className="pointer-events-none absolute left-1/2 top-[18px] -translate-x-1/2 hidden md:block no-print">
          <div className="h-[24px] w-[96px] rounded-full bg-black/90 border border-white/5" />
        </div>
        <div className="device-inner relative h-[100dvh] md:h-full w-full overflow-hidden bg-ivory md:rounded-[44px] print:!h-auto print:!overflow-visible print:!rounded-none">
          {/* Diffused pigment-mist wash behind every screen for a softer, painterly feel */}
          <div aria-hidden className="absolute inset-0 z-0 no-print">
            <div className="pigment-mist" />
            <div className="grain-overlay" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(244,239,232,0.2) 0%, rgba(244,239,232,0.75) 55%, var(--ivory) 85%)" }} />
          </div>
          <div className="device-scroll relative z-10 h-full w-full overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
