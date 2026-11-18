import type { CSSProperties } from "react";

type Props = { day: number; size?: number; className?: string; animated?: boolean };

export function BloomFlower({ day, size = 160, className = "", animated = true }: Props) {
  const roundedDay = Math.round(day);
  const progress = Math.min(1, Math.max(0, roundedDay / 7));
  const reveal = 14 + progress * 86;
  const height = size < 90 ? size : size * 1.34;
  const isSprout = roundedDay <= 2;

  return (
    <div
      className={`flower-specimen ${isSprout ? `flower-specimen-sprout-only flower-specimen-sprout-day-${Math.max(0, roundedDay)}` : ""} ${animated ? "flower-specimen-grow" : ""} ${className}`}
      style={
        {
          width: size,
          height,
          "--flower-reveal": `${100 - reveal}%`,
          "--flower-target-reveal": `${100 - reveal}%`,
        } as CSSProperties
      }
      aria-label={`Day ${roundedDay} growing flower`}
    >
      {isSprout ? (
        <svg className="flower-sprout flower-sprout-standing" viewBox="0 0 120 120" aria-hidden="true">
          {roundedDay === 0 ? <ellipse cx="60" cy="98" rx="12" ry="8" fill="#A18B6F" /> : <>
            <path className="flower-sprout-stem" d={roundedDay <= 1 ? "M60 104 L60 58" : "M60 104 L60 30"} />
            <path className="flower-sprout-leaf flower-sprout-leaf-left" d="M57 76 C42 61 27 64 22 82 C39 86 51 83 57 76 Z" />
            <path className="flower-sprout-leaf flower-sprout-leaf-right" d="M63 71 C79 56 95 60 99 78 C81 83 69 79 63 71 Z" />
            {roundedDay >= 2 && <g className="flower-sprout-new-leaves">
              <path className="flower-sprout-leaf flower-sprout-leaf-left" d="M57 54 C44 39 31 42 28 58 C43 62 52 59 57 54 Z" />
              <path className="flower-sprout-leaf flower-sprout-leaf-right" d="M63 49 C77 34 91 38 94 54 C79 59 69 55 63 49 Z" />
            </g>}
          </>}
        </svg>
      ) : (
        <>
          <div className="flower-specimen-shadow" />
          <img
            src="/solvera-botanical-flower-cutout.png"
            alt=""
            className="flower-specimen-image"
            draggable={false}
          />
        </>
      )}
    </div>
  );
}
