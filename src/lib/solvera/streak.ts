import type { DailyLog } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  if (todayNumber === null || latest === null || latest < todayNumber - 1 || latest > todayNumber) return [];
  let count = 1;
  for (let i = dates.length - 2; i >= 0; i--) {
    if (dayNumber(dates[i]) !== latest - count) break;
    count++;
  }
  return dates.slice(-count);
}

export function currentStreak(logs: Pick<DailyLog, "date">[], today: string): number {
  return currentStreakDates(logs, today).length;
}

export function completedChallengeLogs(logs: DailyLog[]): DailyLog[] {
  const byDate = new Map<string, DailyLog>();
  for (const log of logs) if (dayNumber(log.date) !== null) byDate.set(log.date, log);
  const dates = [...byDate.keys()].sort();
  let run: string[] = [];
  let completed: string[] = [];
  for (const date of dates) {
    const previous = run.length ? dayNumber(run[run.length - 1]) : null;
    run = previous !== null && dayNumber(date) === previous + 1 ? [...run, date] : [date];
    if (run.length >= 7) completed = run.slice(-7);
  }
  return completed.map(date => byDate.get(date)!);
}

export function hasCompletedChallenge(logs: DailyLog[]): boolean {
  return completedChallengeLogs(logs).length === 7;
}
