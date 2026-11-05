import { type ReactNode } from "react";

export function DeviceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="device-frame-outer jiri-page-bg min-h-[100dvh] w-full flex items-stretch md:items-center justify-center md:py-8 print:py-0">
      {/* Diffused desktop pigment wash */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden md:block no-print">
        <div className="ambient-wash" />
        <div className="grain-overlay" />
      </div>

      <div
        className="device-bezel relative w-full md:w-[400px] md:h-[860px] md:rounded-[52px] md:p-[10px] md:shadow-[20px_24px_58px_rgba(44,26,83,0.28)] md:border md:border-white/20 md:bg-[#b8b6c0] print:!p-0 print:!shadow-none print:!border-0"
      >
        {/* Dynamic-island-ish */}
        <div className="pointer-events-none absolute left-1/2 top-[18px] -translate-x-1/2 hidden md:block no-print">
          <div className="h-[24px] w-[96px] rounded-full bg-black/90 border border-white/5" />
        </div>
        <div className="device-inner relative h-[100dvh] md:h-full w-full overflow-hidden bg-mist md:rounded-[44px] md:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] print:!h-auto print:!overflow-visible print:!rounded-none">
          {/* Diffused pigment-mist wash behind every screen for a softer, painterly feel */}
          <div aria-hidden className="absolute inset-0 z-0 no-print">
            <div className="pigment-mist" />
            <div className="grain-overlay" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(237,236,243,0.1) 0%, rgba(237,236,243,0.22) 48%, rgba(126,231,238,0.16) 100%)" }} />
          </div>
          <div className="device-scroll relative z-10 h-full w-full overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
