import type { DailyLog } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 하루쯤 빠뜨려도 식물과 챌린지가 처음부터 다시 시작되지 않도록 허용하는 "쉬어가는 날" 수.
 * 한 번의 연속 구간(run) 안에서만 적용되며, 빠진 날은 기록 일수에 포함되지 않는다.
 * 0으로 바꾸면 예전처럼 7일 연속 기록만 인정한다.
 */
export const GRACE_DAYS = 1;

function dayNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? ms / DAY_MS : null;
}

function uniqueDates(logs: Pick<DailyLog, "date">[]): string[] {
  return [...new Set(logs.map(log => log.date).filter(date => dayNumber(date) !== null))].sort();
}

export function currentStreakDates(logs: Pick<DailyLog, "date">[], today: string): string[] {
  const dates = uniqueDates(logs);
  const todayNumber = dayNumber(today);
  const latest = dates.length ? dayNumber(dates[dates.length - 1]) : null;
  if (todayNumber === null || latest === null || latest > todayNumber) return [];
  // 오늘 기록이 아직 없을 때: 어제까지는 그대로 이어지고, 그저께는 쉬어가는 날이 남아 있을 때만 이어진다.
  const sinceLatest = todayNumber - latest;
  if (sinceLatest > 2) return [];
  let graceUsed = sinceLatest === 2 ? 1 : 0;
  if (graceUsed > GRACE_DAYS) return [];
  let count = 1;
  let previous = latest;
  for (let i = dates.length - 2; i >= 0; i--) {
    const current = dayNumber(dates[i]) as number;
    const gap = previous - current;
    if (gap === 2 && graceUsed < GRACE_DAYS) graceUsed++;
    else if (gap !== 1) break;
    previous = current;
    count++;
  }
  return dates.slice(-count);
}

export function currentStreak(logs: Pick<DailyLog, "date">[], today: string): number {
  return currentStreakDates(logs, today).length;
}

/** 기록된 날 사이에서 빠진 날(쉬어간 날)의 날짜 목록. 리포트에서 숨기지 않고 그대로 보여주기 위해 쓴다. */
export function skippedDatesBetween(dates: string[]): string[] {
  const sorted = [...dates].sort();
  const skipped: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = dayNumber(sorted[i - 1]);
    const cur = dayNumber(sorted[i]);
    if (prev === null || cur === null) continue;
    for (let d = prev + 1; d < cur; d++) skipped.push(new Date(d * DAY_MS).toISOString().slice(0, 10));
  }
  return skipped;
}

export function completedChallengeLogs(logs: DailyLog[]): DailyLog[] {
  const byDate = new Map<string, DailyLog>();
  for (const log of logs) if (dayNumber(log.date) !== null) byDate.set(log.date, log);
  const dates = [...byDate.keys()].sort();
  let run: string[] = [];
  let graceUsed = 0;
  let completed: string[] = [];
  for (const date of dates) {
    const previous = run.length ? dayNumber(run[run.length - 1]) : null;
    const gap = previous !== null ? (dayNumber(date) as number) - previous : null;
    if (gap === 1) run = [...run, date];
    else if (gap === 2 && graceUsed < GRACE_DAYS) { graceUsed++; run = [...run, date]; }
    else { run = [date]; graceUsed = 0; }
    if (run.length >= 7) completed = run.slice(-7);
  }
  return completed.map(date => byDate.get(date)!);
}

export function hasCompletedChallenge(logs: DailyLog[]): boolean {
  return completedChallengeLogs(logs).length === 7;
}
