import type { RecoverySession, DailyLog, ConcernKey } from "./types";
import { CONCERN_LABEL, EMOTION_LABEL, EXERCISE_LABEL, CONTEXT_LABEL } from "./types";

export interface ConcernResult {
  key: ConcernKey;
  label: string;
  start: number;
  end: number;
  delta: number;      // start - end (positive = improvement)
  improvement: number | null; // percentage, or null if start is 0
  series: number[];
}

export function concernResults(session: RecoverySession): ConcernResult[] {
  const logs = session.dailyLogs;
  return session.selectedConcerns.map(key => {
    const series: number[] = [];
    for (const l of logs) {
      const v = l.concernScores[key];
      if (typeof v === "number") series.push(v);
    }
    const start = session.baselineScores[key] ?? series[0] ?? 0;
    const end = series[series.length - 1] ?? start;
    const delta = start - end;
    const improvement = start > 0 ? Math.round((delta / start) * 100) : null;
    return { key, label: CONCERN_LABEL[key], start, end, delta, improvement, series: [start, ...series] };
  });
}

export function averageImprovement(session: RecoverySession): number | null {
  const results = concernResults(session).filter(r => r.improvement !== null) as (ConcernResult & { improvement: number })[];
  if (!results.length) return null;
  const sum = results.reduce((a, r) => a + r.improvement, 0);
  return Math.round(sum / results.length);
}

export function ampouleUsageRate(session: RecoverySession): number {
  const logs = session.dailyLogs;
  if (!logs.length) return 0;
  const used = logs.filter(l => l.ampouleUsed).length;
  return Math.round((used / logs.length) * 100);
}

export function completionRate(session: RecoverySession): number {
  return Math.round((session.dailyLogs.length / 7) * 100);
}

/** Average of that day's selected concern scores. */
export function dailyDiscomfort(log: DailyLog, concerns: ConcernKey[]): number | null {
  const vals = concerns.map(k => log.concernScores[k]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export interface LifestyleFactor {
  key: string;
  label: string;
  category: "sleep" | "emotion" | "exercise" | "context" | "environment";
  withDays: number;
  withoutDays: number;
  withAvg: number;
  withoutAvg: number;
  diff: number; // withAvg - withoutAvg (positive = made skin worse)
}

/** Returns lifestyle factors ranked by |diff|, filtered by min occurrence & significance. */
export function lifestyleFactors(session: RecoverySession): LifestyleFactor[] {
  const concerns = session.selectedConcerns;
  const scored: { log: DailyLog; score: number }[] = session.dailyLogs
    .map(log => ({ log, score: dailyDiscomfort(log, concerns) ?? NaN }))
    .filter(x => Number.isFinite(x.score));

  if (scored.length < 2) return [];

  type Predicate = (l: DailyLog) => boolean;
  const candidates: { key: string; label: string; category: LifestyleFactor["category"]; pred: Predicate }[] = [];

  // Sleep
  candidates.push({ key: "sleep_over7", label: "7시간 이상 수면", category: "sleep", pred: l => l.sleepMinutes >= 7 * 60 });
  candidates.push({ key: "sleep_under6", label: "6시간 미만 수면", category: "sleep", pred: l => l.sleepMinutes < 6 * 60 });

  // Emotions (each keyword)
  const emotionSet = new Set<string>();
  session.dailyLogs.forEach(l => l.emotions.forEach(e => emotionSet.add(e)));
  emotionSet.forEach(e => {
    candidates.push({ key: `emotion_${e}`, label: EMOTION_LABEL[e as keyof typeof EMOTION_LABEL] ?? e, category: "emotion",
      pred: l => l.emotions.includes(e as any) });
  });
  // Tension emotion score high
  candidates.push({ key: "tension_high", label: "긴장·부정 감정 높음", category: "emotion", pred: l => l.emotionStressScore >= 2 });

  // Exercise type
  const exSet = new Set<string>();
  session.dailyLogs.forEach(l => exSet.add(l.exerciseType));
  exSet.forEach(e => {
    if (e === "none") return;
    candidates.push({ key: `ex_${e}`, label: EXERCISE_LABEL[e as keyof typeof EXERCISE_LABEL] ?? e, category: "exercise",
      pred: l => l.exerciseType === e });
  });
  // Sweat high
  candidates.push({ key: "sweat_high", label: "땀이 많은 운동", category: "exercise", pred: l => l.exerciseMeta.sweat === "high" });
  // Indoor / outdoor
  candidates.push({ key: "env_outdoor", label: "야외 운동", category: "environment", pred: l => l.exerciseMeta.environment === "outdoor" });
  candidates.push({ key: "env_indoor", label: "실내 운동", category: "environment", pred: l => l.exerciseMeta.environment === "indoor" });

  // Context factors
  const ctxSet = new Set<string>();
  session.dailyLogs.forEach(l => l.contextFactors.forEach(c => ctxSet.add(c)));
  ctxSet.forEach(c => {
    if (c === "none") return;
    candidates.push({ key: `ctx_${c}`, label: CONTEXT_LABEL[c as keyof typeof CONTEXT_LABEL] ?? c, category: "context",
      pred: l => l.contextFactors.includes(c as any) });
  });

  const factors: LifestyleFactor[] = [];
  for (const c of candidates) {
    const withIt: number[] = [];
    const withoutIt: number[] = [];
    for (const s of scored) (c.pred(s.log) ? withIt : withoutIt).push(s.score);
    if (withIt.length < 2 || withoutIt.length < 1) continue;
    const withAvg = withIt.reduce((a, b) => a + b, 0) / withIt.length;
    const withoutAvg = withoutIt.reduce((a, b) => a + b, 0) / withoutIt.length;
    const diff = withAvg - withoutAvg;
    if (Math.abs(diff) < 0.5) continue;
    factors.push({ key: c.key, label: c.label, category: c.category, withDays: withIt.length, withoutDays: withoutIt.length, withAvg, withoutAvg, diff });
  }
  // dedupe similar labels? Keep top by |diff|
  factors.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return factors.slice(0, 3);
}

export type RecoveryTypeKey =
  | "sleep_sensitive" | "emotion_reactive" | "travel_reactive" | "outdoor_reactive"
  | "exercise_heat" | "hormonal" | "routine_stable" | "observation";

export function recoveryType(session: RecoverySession, topFactors: LifestyleFactor[]): { key: RecoveryTypeKey; label: string; desc: string } {
  const top = topFactors[0];
  if (!top) return { key: "observation", label: "추가 관찰형", desc: "이번 7일은 뚜렷한 단일 요인이 관찰되지 않았어요. 조금 더 기록을 이어가면 패턴이 명확해질 거예요." };
  if (top.category === "sleep") return { key: "sleep_sensitive", label: "수면 민감형", desc: "수면 시간에 따라 피부 컨디션이 크게 달라지는 유형이에요." };
  if (top.category === "emotion") return { key: "emotion_reactive", label: "감정 반응형", desc: `${top.label}을(를) 기록한 날 피부 불편 점수가 눈에 띄게 높았고, 감정과 피부 상태가 함께 움직였어요.` };
  if (top.category === "context") {
    if (top.key === "ctx_trip" || top.key === "ctx_longtravel") return { key: "travel_reactive", label: "이동·여행 반응형", desc: "장시간 이동이나 여행이 있는 날 피부 컨디션이 흔들리는 경향이 있어요." };
    if (top.key === "ctx_outdoor") return { key: "outdoor_reactive", label: "야외활동 반응형", desc: "야외활동을 기록한 날 피부 컨디션이 함께 흔들렸어요." };
    if (top.key === "ctx_menstrual") return { key: "hormonal", label: "호르몬 변화 관찰형", desc: "생리 주기 전후로 피부 컨디션 변화가 관찰됐어요." };
  }
  if (top.category === "exercise" || top.category === "environment") return { key: "exercise_heat", label: "운동·열감 반응형", desc: "강도 높은 운동이나 땀·열이 많은 날 피부가 반응하는 유형이에요." };
  return { key: "routine_stable", label: "루틴 안정형", desc: "생활 요인의 흔들림이 작아 비교적 안정적인 리커버리 패턴을 보였어요." };
}

export function nextWeekSuggestion(topFactors: LifestyleFactor[]): string {
  const top = topFactors[0];
  if (!top) return "다음 7일도 오늘처럼 저녁 앰플 루틴을 일정하게 유지해보세요.";
  if (top.category === "sleep") return "수면이 부족한 날은 다음 날 피부 점수를 함께 확인하고, 저녁 앰플 단계를 빠뜨리지 마세요.";
  if (top.category === "emotion") return `다음 7일은 ${top.label}이(가) 높은 날 저녁 루틴을 일정하게 유지해보세요.`;
  if (top.category === "context") {
    if (top.key === "ctx_trip" || top.key === "ctx_longtravel") return "장시간 이동이나 여행이 있는 날에는 보습 루틴을 미리 준비해보세요.";
    if (top.key === "ctx_outdoor") return "야외활동이 있는 날은 귀가 직후 클렌징과 앰플 루틴을 빠르게 이어가보세요.";
    if (top.key === "ctx_alcohol") return "음주가 있는 날에는 다음 날 아침 피부 열감을 확인하며 진정 루틴을 이어가세요.";
  }
  if (top.category === "exercise" || top.category === "environment") return "운동 후에는 피부 열감과 땀을 빠르게 정리하고 앰플 루틴을 이어가보세요.";
  return "다음 7일도 오늘의 루틴을 이어가며 변화를 관찰해보세요.";
}

export function sleepMinutesFromTimes(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let start = bh * 60 + bm;
  let end = wh * 60 + wm;
  if (end <= start) end += 24 * 60;
  return end - start;
}
export function sleepCategoryFrom(minutes: number): import("./types").SleepCategory {
  if (minutes < 5 * 60) return "under5";
  if (minutes < 6 * 60) return "fiveToSix";
  if (minutes < 7 * 60) return "sixToSeven";
  return "overSeven";
}
