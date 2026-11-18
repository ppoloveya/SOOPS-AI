import type { RecoverySession } from "./types";
import { completedChallengeLogs, currentStreakDates } from "./streak.ts";

export const GROWTH_STAGES = [
  "씨앗", "첫 새싹", "새 잎", "줄기", "꽃봉오리", "봉오리 성장", "개화 직전", "찔레꽃 개화",
] as const;

export const MAX_GROWTH_XP = 790;
export const FERTILIZER_DAYS = [2, 4, 6] as const;

export function growthProgress(session: RecoverySession, today: string) {
  const dates = session.completed
    ? completedChallengeLogs(session.dailyLogs).map(log => log.date)
    : currentStreakDates(session.dailyLogs, today);
  const day = Math.min(dates.length, 7);
  const watered = new Set(session.wateredDates);
  const fertilized = new Set(session.fertilizedDates);
  const wateredCount = dates.filter(date => watered.has(date)).length;
  const fertilizedCount = dates.filter((date, index) => FERTILIZER_DAYS.some(value => value === index + 1) && fertilized.has(date)).length;
  const wateredToday = dates.includes(today) && watered.has(today);
  const fertilizedToday = dates.includes(today) && fertilized.has(today);
  return {
    day,
    xp: day * 80 + wateredCount * 20 + fertilizedCount * 30,
    canWater: dates.includes(today) && !watered.has(today),
    wateredToday,
    canFertilize: FERTILIZER_DAYS.some(value => value === day) && wateredToday && !fertilizedToday,
    fertilizedToday,
  };
}
