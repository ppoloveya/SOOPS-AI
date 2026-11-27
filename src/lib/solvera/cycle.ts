import type { DailyLog, RecoverySession } from "./types.ts";

/** 분석용으로 이어받는 이전 기록의 최대 일수. 너무 오래된 기록이 현재 패턴을 흐리지 않도록 약 3개월만 유지한다. */
export const MAX_ARCHIVED_DAYS = 90;

/**
 * 7일을 마친 뒤 같은 사용자가 이어서 기록할 새 주기를 만든다.
 * 이전 기록은 지우지 않고 archivedLogs로 넘겨 다음 리포트의 비교 표본에 합친다(성장·챌린지 계산에는 섞지 않음).
 * 새 주기의 시작 점수는 직전 주기 마지막 2일의 평균이라 "지난주 끝난 지점"에서 이어서 비교한다.
 */
export function startNextCycle(session: RecoverySession): RecoverySession {
  const merged = new Map<string, DailyLog>();
  for (const log of session.archivedLogs ?? []) merged.set(log.date, log);
  for (const log of session.dailyLogs) merged.set(log.date, log);
  const archivedLogs = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_ARCHIVED_DAYS);

  const baselineScores: RecoverySession["baselineScores"] = { ...session.baselineScores };
  for (const key of session.selectedConcerns) {
    const recent = session.dailyLogs.slice(-2).map(log => log.concernScores[key]).filter((v): v is number => typeof v === "number");
    if (recent.length) baselineScores[key] = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  }

  return {
    ...session,
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    baselineScores,
    dailyLogs: [],
    wateredDates: [],
    fertilizedDates: [],
    completed: false,
    archivedLogs,
  };
}
