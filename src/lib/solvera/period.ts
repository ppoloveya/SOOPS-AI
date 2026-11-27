/**
 * 생리 주기 계산. 시작일만 받아서 "생리 중 / 생리 전 7일 / 그 외"를 날짜별로 나눈다.
 * 시작일은 가장 민감한 정보라 이 기기에만 저장하고(서버 동기화 행에 포함하지 않는다), 의학적 예측이 아니라 날짜 계산이다.
 * 근거: 생리 전 트러블 악화는 여성 400명 설문에서 44%(Stoll 2001), 병변 수 기준 63%(Lucky 2004)로 보고됐다. 유병률은 방법에 따라 달라 정확한 값은 불분명하다.
 */
export type PeriodPhase = "menstrual" | "pre" | "mid";

export const DEFAULT_CYCLE_DAYS = 28;
export const MIN_CYCLE_DAYS = 21;
export const MAX_CYCLE_DAYS = 40;
/** 경험칙: 시작일부터 5일을 "생리 중"으로, 다음 시작 예정일 전 7일을 "생리 전"으로 본다. */
export const MENSTRUAL_DAYS = 5;
export const PRE_DAYS = 7;
/** 마지막 시작일에서 예정 주기보다 이만큼 더 지나도 새 시작일이 없으면 기록이 끊긴 것으로 보고 구간을 판단하지 않는다. */
export const OVERDUE_GRACE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const dn = (date: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? ms / DAY_MS : null;
};
const iso = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export function normalizeStarts(starts: readonly string[] | undefined): string[] {
  return [...new Set((starts ?? []).filter(s => dn(s) !== null))].sort();
}

/** 연속한 시작일 간격(21~40일) 중간값. 간격을 알 수 없으면 28일. */
export function cycleLength(starts: readonly string[] | undefined): number {
  const s = normalizeStarts(starts);
  const gaps: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const gap = (dn(s[i]) as number) - (dn(s[i - 1]) as number);
    if (gap >= MIN_CYCLE_DAYS && gap <= MAX_CYCLE_DAYS) gaps.push(gap);
  }
  if (!gaps.length) return DEFAULT_CYCLE_DAYS;
  gaps.sort((a, b) => a - b);
  const mid = gaps.length / 2;
  return Math.round(gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[mid - 1] + gaps[mid]) / 2);
}

export function nextPeriodStart(starts: readonly string[] | undefined): string | null {
  const s = normalizeStarts(starts);
  if (!s.length) return null;
  return iso((dn(s[s.length - 1]) as number) + cycleLength(s));
}

/** 그날이 어느 구간인지. 그날 이전의 시작일이 없거나 기록이 끊겼으면 null(비교에서 제외). */
export function periodPhase(date: string, starts: readonly string[] | undefined): PeriodPhase | null {
  const target = dn(date);
  if (target === null) return null;
  const s = normalizeStarts(starts).filter(x => (dn(x) as number) <= target);
  if (!s.length) return null;
  const since = target - (dn(s[s.length - 1]) as number);
  const len = cycleLength(starts);
  if (since >= len + OVERDUE_GRACE_DAYS) return null;
  if (since < MENSTRUAL_DAYS) return "menstrual";
  if (since >= len - PRE_DAYS) return "pre";
  return "mid";
}

/** 다음 "생리 전 7일" 구간의 첫날과 끝날(예정 시작일 전날). */
export function nextPreWindow(starts: readonly string[] | undefined): { from: string; to: string } | null {
  const next = nextPeriodStart(starts);
  if (!next) return null;
  const n = dn(next) as number;
  return { from: iso(n - PRE_DAYS), to: iso(n - 1) };
}
