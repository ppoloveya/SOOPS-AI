import * as React from "react";
/**
 * BloomFlower — 7 distinct SVG illustrations of a Korean wild rose (찔레꽃) opening across 7 days.
 * Each day has its own hand-authored path work. NO morphing / scaling one shape.
 */
type Props = { day: number; size?: number; className?: string };

// Common stem + leaves used across days (subtle underlay)
function Stem({ compact = false }: { compact?: boolean }) {
  if (compact) return null;
  return (
    <g stroke="#71876B" strokeWidth={1.4} fill="none" strokeLinecap="round">
      <path d="M100 175 C 102 155 98 135 100 118" />
      <path d="M100 158 C 92 152 86 148 78 149" />
      <path d="M78 149 C 74 145 74 140 78 137 C 84 137 90 142 92 148" fill="#8FA085" opacity="0.55" stroke="none" />
      <path d="M100 145 C 108 140 116 138 122 141" />
      <path d="M122 141 C 128 140 130 136 128 132 C 122 130 114 132 110 138" fill="#8FA085" opacity="0.55" stroke="none" />
    </g>
  );
}

// Yellow stamens (used in later days)
function Stamens({ cx, cy, r, count = 26 }: { cx: number; cy: number; r: number; count?: number }) {
  const dots = Array.from({ length: count }).map((_, i) => {
    const a = (i / count) * Math.PI * 2;
    const rr = r * (0.55 + ((i * 37) % 100) / 260);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    return <circle key={i} cx={x} cy={y} r={0.9} fill="#E8B84A" />;
  });
  // central pistil cluster
  const inner = Array.from({ length: 8 }).map((_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return <circle key={`i${i}`} cx={cx + Math.cos(a) * 2.2} cy={cy + Math.sin(a) * 2.2} r={1.1} fill="#D4A02C" />;
  });
  return (
    <g>
      {dots}
      {inner}
      <circle cx={cx} cy={cy} r={1.4} fill="#B47F1E" />
    </g>
  );
}

function Petal({ d, fill = "#F4C6D3", opacity = 1 }: { d: string; fill?: string; opacity?: number }) {
  return <path d={d} fill={fill} stroke="#D68DA0" strokeWidth={0.6} opacity={opacity} />;
}

function Day1() {
  return (
    <>
      <Stem />
      {/* tight closed bud */}
      <g>
        <ellipse cx={100} cy={95} rx={12} ry={20} fill="#A8B49F" />
        <ellipse cx={100} cy={92} rx={9} ry={17} fill="#C9B4B9" />
        <path d="M92 95 C 96 78 104 78 108 95 C 106 100 94 100 92 95Z" fill="#E7A6B8" opacity={0.55} />
        <path d="M100 78 C 97 72 103 72 100 78" stroke="#71876B" strokeWidth={1} fill="none" />
      </g>
    </>
  );
}

function Day2() {
  return (
    <>
      <Stem />
      <g>
        <ellipse cx={100} cy={94} rx={16} ry={22} fill="#B8C3AC" />
        <ellipse cx={100} cy={90} rx={12} ry={19} fill="#DDBCC4" />
        <path d="M88 92 C 92 72 108 72 112 92 C 108 100 92 100 88 92Z" fill="#EDB6C4" />
        <path d="M100 74 C 96 68 104 68 100 74" stroke="#71876B" strokeWidth={1} fill="none" />
        <path d="M96 82 C 100 78 104 82 100 88" stroke="#D68DA0" strokeWidth={0.6} fill="none" />
      </g>
    </>
  );
}

function Day3() {
  return (
    <>
      <Stem />
      <g transform="translate(100 96)">
        <Petal d="M -22 -6 C -30 -22 -14 -34 -4 -22 C -6 -12 -14 -4 -22 -6 Z" />
        <Petal d="M 22 -6 C 30 -22 14 -34 4 -22 C 6 -12 14 -4 22 -6 Z" />
        <ellipse cx={0} cy={-4} rx={12} ry={18} fill="#EDB6C4" />
        <ellipse cx={0} cy={-6} rx={8} ry={12} fill="#F4C6D3" />
        <circle cx={0} cy={-4} r={3} fill="#E8B84A" opacity={0.5} />
      </g>
    </>
  );
}

function Day4() {
  return (
    <>
      <Stem />
      <g transform="translate(100 96)">
        <Petal d="M -28 -6 C -38 -26 -14 -38 -4 -22 C -8 -14 -18 -4 -28 -6 Z" />
        <Petal d="M 28 -6 C 38 -26 14 -38 4 -22 C 8 -14 18 -4 28 -6 Z" />
        <Petal d="M -18 12 C -30 8 -32 -8 -18 -14 C -10 -8 -10 4 -18 12 Z" opacity={0.9} />
        <Petal d="M 18 12 C 30 8 32 -8 18 -14 C 10 -8 10 4 18 12 Z" opacity={0.9} />
        <ellipse cx={0} cy={-4} rx={10} ry={14} fill="#F4C6D3" />
        <Stamens cx={0} cy={-4} r={7} count={12} />
      </g>
    </>
  );
}

function Day5() {
  // ~70% open — 5 petals visible, centre yellow
  return (
    <>
      <Stem />
      <g transform="translate(100 96)">
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <g key={i} transform={`rotate(${deg - 90})`}>
            <Petal d="M -14 0 C -20 -22 -6 -34 0 -28 C 6 -34 20 -22 14 0 C 8 8 -8 8 -14 0 Z" />
          </g>
        ))}
        <circle cx={0} cy={0} r={9} fill="#F5E6BB" />
        <Stamens cx={0} cy={0} r={9} count={20} />
      </g>
    </>
  );
}

function Day6() {
  return (
    <>
      <Stem />
      <g transform="translate(100 96)">
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <g key={i} transform={`rotate(${deg - 90})`}>
            <Petal d="M -18 2 C -26 -26 -8 -40 0 -34 C 8 -40 26 -26 18 2 C 10 12 -10 12 -18 2 Z" />
          </g>
        ))}
        <circle cx={0} cy={0} r={11} fill="#F5E6BB" />
        <Stamens cx={0} cy={0} r={11} count={26} />
      </g>
    </>
  );
}

function Day7() {
  // Fully open, front-facing wild rose. 5 broad thin pink petals, rich yellow stamens.
  return (
    <>
      <Stem />
      <g transform="translate(100 96)">
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <g key={i} transform={`rotate(${deg - 90})`}>
            {/* petal back (slightly darker edge) */}
            <path
              d="M -24 4 C -34 -28 -10 -46 0 -40 C 10 -46 34 -28 24 4 C 14 16 -14 16 -24 4 Z"
              fill="#F4C6D3" stroke="#D68DA0" strokeWidth={0.6}
            />
            {/* subtle vein */}
            <path d="M 0 -38 C 2 -22 2 -8 0 4" stroke="#D68DA0" strokeWidth={0.5} opacity={0.55} fill="none" />
            {/* highlight */}
            <path
              d="M -18 -2 C -22 -22 -6 -34 0 -32 C 6 -34 22 -22 18 -2 C 12 8 -12 8 -18 -2 Z"
              fill="#F8D8E1" opacity={0.7}
            />
          </g>
        ))}
        {/* Yellow stamen cushion */}
        <circle cx={0} cy={0} r={13} fill="#F5E6BB" />
        <Stamens cx={0} cy={0} r={13} count={36} />
      </g>
    </>
  );
}

const RENDERERS: Record<number, () => React.ReactElement> = {
  1: Day1, 2: Day2, 3: Day3, 4: Day4, 5: Day5, 6: Day6, 7: Day7,
};

export function BloomFlower({ day, size = 160, className = "" }: Props) {
  const d = Math.min(7, Math.max(1, Math.round(day)));
  const R = RENDERERS[d];
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} aria-label={`Day ${d} bloom`}>
      <R />
    </svg>
  );
}
