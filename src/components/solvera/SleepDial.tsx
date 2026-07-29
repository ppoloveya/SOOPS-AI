import { useEffect, useRef, useState } from "react";

/**
 * SleepDial — 24-hour circular sleep dial (Apple-like, inspired but not cloned).
 * Two draggable handles for bed and wake. Arc shows the sleep window.
 * Aspect ratio 1:1 → dial size stable regardless of time values.
 */

type Props = {
  bedtime: string;    // "HH:MM"
  wakeTime: string;   // "HH:MM"
  onChange: (bedtime: string, wakeTime: string) => void;
};

const RADIUS = 108;
const STROKE = 22;
const CENTER = 130;
const SIZE = 260;

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function minToAngle(min: number) {
  // 0min (00:00) = -90deg (top). Full 1440min = 360deg.
  return (min / 1440) * 360 - 90;
}
function angleToMin(deg: number) {
  const d = ((deg + 90) % 360 + 360) % 360;
  const raw = (d / 360) * 1440;
  return Math.round(raw / 5) * 5; // snap 5 min
}
function polar(min: number, r = RADIUS) {
  const a = (minToAngle(min) * Math.PI) / 180;
  return { x: CENTER + Math.cos(a) * r, y: CENTER + Math.sin(a) * r };
}

export function SleepDial({ bedtime, wakeTime, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<"bed" | "wake" | null>(null);

  const bedMin = toMin(bedtime);
  const wakeMin = toMin(wakeTime);

  // Sleep arc from bed → wake (going forward, may cross midnight)
  const arcSweep = (() => {
    let end = wakeMin; if (end <= bedMin) end += 1440;
    return end - bedMin;
  })();

  const arcPath = (() => {
    const start = polar(bedMin);
    const end = polar(wakeMin);
    const large = arcSweep > 720 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
  })();

  useEffect(() => {
    if (!drag) return;
    const svg = svgRef.current; if (!svg) return;
    const move = (e: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left - (SIZE / (rect.width / (rect.width)) ) * 0; // no-op
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const newMin = angleToMin(deg);
      if (drag === "bed") onChange(fromMin(newMin), wakeTime);
      else onChange(bedtime, fromMin(newMin));
      // suppress unused
      void x;
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, bedtime, wakeTime, onChange]);

  const bed = polar(bedMin);
  const wake = polar(wakeMin);

  const hourTicks = Array.from({ length: 24 }).map((_, i) => {
    const angle = (i / 24) * 360 - 90;
    const a = (angle * Math.PI) / 180;
    const r1 = RADIUS - STROKE / 2 - 6;
    const r2 = RADIUS - STROKE / 2 - (i % 6 === 0 ? 14 : 10);
    return (
      <line key={i}
        x1={CENTER + Math.cos(a) * r1} y1={CENTER + Math.sin(a) * r1}
        x2={CENTER + Math.cos(a) * r2} y2={CENTER + Math.sin(a) * r2}
        stroke="#C9BFB2" strokeWidth={i % 6 === 0 ? 1.4 : 0.8} strokeLinecap="round"
      />
    );
  });

  const hourLabels = [0, 6, 12, 18].map(h => {
    const a = ((h / 24) * 360 - 90) * Math.PI / 180;
    const r = RADIUS - STROKE / 2 - 30;
    return (
      <text key={h} x={CENTER + Math.cos(a) * r} y={CENTER + Math.sin(a) * r + 4}
        textAnchor="middle" fontSize={11} fill="#8B7F73" className="tnum">
        {String(h).padStart(2, "0")}
      </text>
    );
  });

  return (
    <div className="w-full" style={{ aspectRatio: "1 / 1", maxWidth: 320, margin: "0 auto" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%" height="100%"
        style={{ touchAction: "none", display: "block" }}
      >
        {/* track */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#EFE7DA" strokeWidth={STROKE} />
        {hourTicks}
        {hourLabels}

        {/* sleep arc */}
        <path d={arcPath} stroke="#A78BC4" strokeWidth={STROKE} strokeLinecap="round" fill="none" />

        {/* Handles */}
        <g
          onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag("bed"); }}
          style={{ cursor: "grab" }}
        >
          <circle cx={bed.x} cy={bed.y} r={16} fill="#24152B" stroke="#F4EFE8" strokeWidth={3} />
          <text x={bed.x} y={bed.y + 3.5} textAnchor="middle" fontSize={10} fill="#F4EFE8">🌙</text>
        </g>
        <g
          onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag("wake"); }}
          style={{ cursor: "grab" }}
        >
          <circle cx={wake.x} cy={wake.y} r={16} fill="#E7A6B8" stroke="#F4EFE8" strokeWidth={3} />
          <text x={wake.x} y={wake.y + 3.5} textAnchor="middle" fontSize={10} fill="#24152B">☀</text>
        </g>
      </svg>
    </div>
  );
}
