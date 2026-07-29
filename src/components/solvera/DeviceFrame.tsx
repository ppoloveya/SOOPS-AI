import { type ReactNode } from "react";

export function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="device-frame-outer min-h-[100dvh] w-full flex items-stretch md:items-center justify-center md:py-8 print:py-0">
      {/* Slow glow orbs (desktop bg accent) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden md:block no-print">
        <div className="slow-glow absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
             style={{ background: "radial-gradient(circle, rgba(167,139,196,0.22), transparent 60%)" }} />
        <div className="slow-glow absolute left-1/4 bottom-0 h-[420px] w-[420px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(24,52,45,0.35), transparent 60%)", animationDelay: "-4s" }} />
      </div>

      <div
        className="device-bezel relative w-full md:w-[400px] md:h-[860px] md:rounded-[52px] md:p-[10px] md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] md:border md:border-black/60 md:bg-[#0a0508] print:!p-0 print:!shadow-none print:!border-0"
      >
        {/* Dynamic-island-ish */}
        <div className="pointer-events-none absolute left-1/2 top-[18px] -translate-x-1/2 hidden md:block no-print">
          <div className="h-[24px] w-[96px] rounded-full bg-black/90 border border-white/5" />
        </div>
        <div className="device-inner relative h-[100dvh] md:h-full w-full overflow-hidden bg-ivory md:rounded-[44px] print:!h-auto print:!overflow-visible print:!rounded-none">
          <div className="device-scroll h-full w-full overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
