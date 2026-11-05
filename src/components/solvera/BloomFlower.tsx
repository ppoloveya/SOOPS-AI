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
      className={`flower-specimen ${isSprout ? "flower-specimen-sprout-only" : ""} ${animated ? "flower-specimen-grow" : ""} ${className}`}
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
          <path className="flower-sprout-stem" d="M60 104 L60 39" />
          <path className="flower-sprout-leaf flower-sprout-leaf-left" d="M57 70 C38 54 20 57 13 78 C35 83 50 79 57 70 Z" />
          <path className="flower-sprout-leaf flower-sprout-leaf-right" d="M63 62 C84 44 104 48 111 70 C89 78 72 73 63 62 Z" />
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
