import type { RecoverySession, DailyLog, ConcernKey } from "./types";
import { CONCERN_LABEL, EMOTION_LABEL, EXERCISE_LABEL, CONTEXT_LABEL } from "./types";
import { currentStreak, hasCompletedChallenge } from "./streak";
import { todayISO } from "./storage";

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
  if (hasCompletedChallenge(session.dailyLogs)) return 100;
  return Math.min(100, Math.round((currentStreak(session.dailyLogs, todayISO()) / 7) * 100));
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
  diff: number; // withAvg - withoutAvg; descriptive, not causal
}

/** Exploratory within-person contrasts; neither significance nor causation is inferred. */
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
    if (withIt.length < 2 || withoutIt.length < 2) continue;
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
  if (!top) return { key: "observation", label: "추가 관찰형", desc: "이번 7일은 비교할 수 있는 날이 충분한 단일 생활 요인이 없었어요. 다음 기록에서 같은 항목을 이어서 살펴보세요." };
  const desc = `${top.label}을(를) 기록한 ${top.withDays}일의 피부 불편 점수가 기록하지 않은 ${top.withoutDays}일보다 평균 ${Math.abs(top.diff).toFixed(1)}점 ${top.diff > 0 ? "높았어요" : "낮았어요"}. 함께 나타난 패턴이며 원인으로 단정할 수는 없어요.`;
  if (top.category === "sleep") return { key: "sleep_sensitive", label: "수면 동반형", desc };
  if (top.category === "emotion") return { key: "emotion_reactive", label: "감정 동반형", desc };
  if (top.category === "context") {
    if (top.key === "ctx_trip" || top.key === "ctx_longtravel") return { key: "travel_reactive", label: "이동·여행 동반형", desc };
    if (top.key === "ctx_outdoor") return { key: "outdoor_reactive", label: "야외활동 동반형", desc };
    if (top.key === "ctx_menstrual") return { key: "hormonal", label: "주기 동반형", desc };
  }
  if (top.category === "exercise" || top.category === "environment") return { key: "exercise_heat", label: "활동 동반형", desc };
  return { key: "routine_stable", label: "생활 리듬 동반형", desc };
}

export function nextWeekSuggestion(topFactors: LifestyleFactor[]): string {
  const top = topFactors[0];
  if (!top) return "다음 7일도 같은 시간대에 피부 불편 점수를 기록해 비교 가능한 날을 늘려보세요.";
  if (top.category === "sleep") return "다음 7일에는 수면 시간과 다음 날 피부 불편 점수를 함께 기록해 패턴이 반복되는지 확인해보세요.";
  if (top.category === "emotion") return `다음 7일에는 ${top.label}을(를) 느낀 날과 아닌 날의 피부 점수를 계속 비교해보세요.`;
  if (top.category === "context") {
    if (top.key === "ctx_trip" || top.key === "ctx_longtravel") return "다음 이동·여행 때도 피부 불편 점수를 같은 기준으로 기록해 이번 패턴과 비교해보세요.";
    if (top.key === "ctx_outdoor") return "야외활동이 있던 날과 아닌 날의 피부 점수를 다음 주에도 나란히 살펴보세요.";
    if (top.key === "ctx_alcohol") return "음주한 날과 다음 날의 피부 열감·붉은기 점수를 따로 기록해보세요.";
  }
  if (top.category === "exercise" || top.category === "environment") return "운동한 날의 땀·열감과 피부 점수를 다음 주에도 함께 기록해보세요.";
  return `다음 7일에는 ${top.label}이(가) 있었던 날의 피부 점수를 다시 비교해보세요.`;
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
