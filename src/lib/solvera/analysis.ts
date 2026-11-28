import type { RecoverySession, DailyLog, ConcernKey, EmotionKey, ContextKey, LogField } from "./types.ts";
import { CONCERN_LABEL, EMOTION_LABEL, EXERCISE_LABEL, CONTEXT_LABEL } from "./types.ts";
import { completedChallengeLogs, currentStreak, hasCompletedChallenge, skippedDatesBetween } from "./streak.ts";
import { todayISO } from "./storage.ts";
import { LITERATURE, MEANINGFUL_ABSOLUTE, MEANINGFUL_RELATIVE, MIN_DAYS_PER_GROUP, MIN_MEAN_DIFF, REPEATED_MIN_NAP, REPEATED_MIN_WITH_DAYS } from "./evidence.ts";
import { DEFAULT_PRIOR, estimateDifference, type Prior } from "./estimate.ts";
import { periodPhase } from "./period.ts";

export interface ConcernResult {
  key: ConcernKey;
  label: string;
  start: number;
  end: number;
  delta: number;      // start - end (positive = improvement)
  improvement: number | null; // percentage, or null if start is 0
  series: number[];
  /** 마지막 최대 2일 평균 — 하루치 점수의 들쭉날쭉함을 줄이기 위한 보조 끝점 */
  endRecent: number;
  /** 시작점 대비 변화가 "의미 있는 변화 폭"(약 2점 또는 약 30%) 이상인지 — 자가 기록 기준일 뿐 효과 판정이 아님 */
  meaningful: boolean;
}

/** 리포트가 근거로 삼는 기록: 7일 챌린지를 마쳤다면 그 구간의 7일, 아니면 지금까지의 기록 전체. */
export function reportLogs(session: RecoverySession): DailyLog[] {
  return hasCompletedChallenge(session.dailyLogs) ? completedChallengeLogs(session.dailyLogs) : session.dailyLogs;
}

export function concernResults(session: RecoverySession): ConcernResult[] {
  const logs = reportLogs(session);
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
    const tail = series.slice(-2);
    const endRecent = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : start;
    const change = Math.abs(start - endRecent);
    const meaningful = change >= MEANINGFUL_ABSOLUTE || (start > 0 && change / start >= MEANINGFUL_RELATIVE);
    return { key, label: CONCERN_LABEL[key], start, end, delta, improvement, series: [start, ...series], endRecent, meaningful };
  });
}

export type OverallVerdict = "better" | "same" | "worse";

/** 선택한 고민 전체의 평균 변화: 시작 점수 평균과 마지막 이틀 평균을 비교해 "의미 있는 변화 폭"(약 2점 또는 30%) 이상일 때만 좋아짐/나빠짐으로 말한다. */
export function overallChange(session: RecoverySession): { baseline: number; recent: number; delta: number; verdict: OverallVerdict } | null {
  const results = concernResults(session);
  if (!results.length) return null;
  const baseline = results.reduce((a, r) => a + r.start, 0) / results.length;
  const recent = results.reduce((a, r) => a + r.endRecent, 0) / results.length;
  const delta = baseline - recent;
  const big = Math.abs(delta) >= MEANINGFUL_ABSOLUTE || (baseline > 0 && Math.abs(delta) / baseline >= MEANINGFUL_RELATIVE);
  return { baseline, recent, delta, verdict: !big ? "same" : delta > 0 ? "better" : "worse" };
}

export function averageImprovement(session: RecoverySession): number | null {
  const results = concernResults(session).filter(r => r.improvement !== null) as (ConcernResult & { improvement: number })[];
  if (!results.length) return null;
  const sum = results.reduce((a, r) => a + r.improvement, 0);
  return Math.round(sum / results.length);
}

export function ampouleUsageRate(session: RecoverySession): number {
  const logs = reportLogs(session);
  if (!logs.length) return 0;
  const answered = logs.filter(l => !isDefault(l, "ampoule"));
  if (!answered.length) return 0;
  const used = answered.filter(l => l.ampouleUsed).length;
  return Math.round((used / answered.length) * 100);
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
  category: "sleep" | "emotion" | "exercise" | "context" | "environment" | "weather";
  withDays: number;
  withoutDays: number;
  withAvg: number;
  withoutAvg: number;
  diff: number; // withAvg - withoutAvg; descriptive, not causal
  /** 기록이 적을수록 0쪽으로 줄인 추정 차이와 95% 범위 — 기록이 쌓이면 범위가 좁아진다 */
  shrunkDiff: number;
  ciLow: number;
  ciHigh: number;
  /** 추정 범위가 0을 포함하지 않는가 */
  clear: boolean;
  /** 관측 차이의 표준오차 */
  se: number;
  /** 이 비교에 실제로 쓰인 날짜 — 리포트에서 근거를 그대로 보여주기 위함 */
  withDates: string[];
  withoutDates: string[];
  /** 요인이 있던 날 중, 없던 날 평균보다 같은 방향(높거나 낮게)으로 기록된 날의 비율 (0~1) */
  consistency: number;
  /** 있던 날과 없던 날의 모든 쌍을 비교했을 때 있던 날 점수가 더 높았던 비율 (0~1, NAP 방식) */
  nap: number;
  /** 전날 요인과 다음 날 피부 점수를 잇는 비교인지 */
  lagged: boolean;
  /** 선행 연구가 같은 방향의 가설을 제시한 요인에만 붙는 한 줄 설명 */
  literature?: string;
  /** reference: 참고용 / repeated: 여러 날에 걸쳐 같은 방향이 반복됨 */
  confidence: "reference" | "repeated";
}

const DAY_MS = 24 * 60 * 60 * 1000;
function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

/** NAP(Nonoverlap of All Pairs): 두 그룹의 모든 쌍 중 첫 그룹이 더 큰 비율. 같으면 0.5. 소수 일자 비교에 쓰이는 비모수 지표. */
export function nonoverlapAllPairs(group: number[], other: number[]): number {
  if (!group.length || !other.length) return 0.5;
  let total = 0;
  for (const x of group) for (const y of other) total += x > y ? 1 : x === y ? 0.5 : 0;
  return total / (group.length * other.length);
}

/** 이 항목이 고객이 직접 입력·확인한 값이 아니라 기본값인지. 출처 정보가 없는 이전 기록은 직접 입력으로 본다. */
export const isDefault = (log: DailyLog, field: LogField): boolean => log.sources?.[field] === "default";

type FactorEntry = { log: DailyLog; prev?: DailyLog; score: number };

/**
 * 분석·예측용 기록: 이어받은 이전 주기 기록 + 이번에 쌓인 모든 기록. 날짜 중복은 최신 기록이 이긴다.
 * 7일 챌린지 구간으로 자르지 않는다 — 재발 예측과 생리 주기 비교는 28일 이상의 연속 기록이 있어야 하기 때문이다.
 * (리포트 화면은 앱이 이미 완주한 7일 구간만 넘겨서 보여준다.)
 */
export function analysisLogs(session: RecoverySession): DailyLog[] {
  const byDate = new Map<string, DailyLog>();
  for (const log of session.archivedLogs ?? []) byDate.set(log.date, log);
  for (const log of session.dailyLogs) byDate.set(log.date, log);
  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
}

/** Exploratory within-person contrasts; neither significance nor causation is inferred. */
export function lifestyleFactors(
  session: RecoverySession,
  opts: { priors?: Record<string, Prior>; includeAll?: boolean } = {},
): LifestyleFactor[] {
  const concerns = session.selectedConcerns;
  const logsUsed = analysisLogs(session);
  const byDate = new Map(logsUsed.map(l => [l.date, l]));
  const scored: FactorEntry[] = logsUsed
    .map(log => ({ log, prev: byDate.get(previousDate(log.date)), score: dailyDiscomfort(log, concerns) ?? NaN }))
    .filter(x => Number.isFinite(x.score));

  if (scored.length < 2) return [];

  // 반환값: true=요인 있음, false=없음, null=이 비교에서 제외(예: 전날 기록 없음)
  type Pred = (e: FactorEntry) => boolean | null;
  const candidates: { key: string; label: string; category: LifestyleFactor["category"]; pred: Pred; lagged?: boolean; literature?: string }[] = [];
  // 고객이 말하지 않아 기본값으로 채워진 항목은 비교에서 뺀다(null) — 입력하지 않은 값이 근거가 되지 않도록.
  const same = (field: LogField, f: (l: DailyLog) => boolean): Pred => e => (isDefault(e.log, field) ? null : f(e.log));
  const prevDay = (field: LogField, f: (l: DailyLog) => boolean): Pred => e => (e.prev && !isDefault(e.prev, field) ? f(e.prev) : null);

  // 생리 주기 — 시작일을 기록한 경우에만. "생리 전 7일"이 가장 근거가 있는 후보다.
  if ((session.periodStarts ?? []).length >= 1) {
    const phaseOf = (e: FactorEntry) => periodPhase(e.log.date, session.periodStarts);
    candidates.push({ key: "cycle_pre", label: "생리 전 7일", category: "context", pred: e => { const p = phaseOf(e); return p === null ? null : p === "pre"; }, literature: LITERATURE.cycle });
    candidates.push({ key: "cycle_menstrual", label: "생리 중", category: "context", pred: e => { const p = phaseOf(e); return p === null ? null : p === "menstrual"; } });
  }

  // Sleep — 같은 날 기록 + 전날 수면이 다음 날 피부에 이어지는지(장벽 회복은 수일에 걸쳐 측정됨)
  candidates.push({ key: "sleep_over7", label: "7시간 이상 수면", category: "sleep", pred: same("sleep", l => l.sleepMinutes >= 7 * 60) });
  candidates.push({ key: "sleep_under6", label: "6시간 미만 수면", category: "sleep", pred: same("sleep", l => l.sleepMinutes < 6 * 60), literature: LITERATURE.sleep });
  candidates.push({ key: "sleep_under6_prev", label: "전날 6시간 미만 수면", category: "sleep", lagged: true, pred: prevDay("sleep", l => l.sleepMinutes < 6 * 60), literature: LITERATURE.sleep });

  // Emotions (each keyword)
  const emotionSet = new Set<string>();
  logsUsed.forEach(l => { if (!isDefault(l, "emotions")) l.emotions.forEach(e => emotionSet.add(e)); });
  emotionSet.forEach(e => {
    candidates.push({ key: `emotion_${e}`, label: EMOTION_LABEL[e as keyof typeof EMOTION_LABEL] ?? e, category: "emotion",
      pred: same("emotions", l => l.emotions.includes(e as EmotionKey)) });
  });
  candidates.push({ key: "tension_high", label: "긴장·부정 감정 높음", category: "emotion", pred: same("emotions", l => l.emotionStressScore >= 2), literature: LITERATURE.stress });
  candidates.push({ key: "tension_high_prev", label: "전날 긴장·부정 감정 높음", category: "emotion", lagged: true, pred: prevDay("emotions", l => l.emotionStressScore >= 2), literature: LITERATURE.stress });

  // Exercise type
  const exSet = new Set<string>();
  logsUsed.forEach(l => { if (!isDefault(l, "exercise")) exSet.add(l.exerciseType); });
  exSet.forEach(e => {
    if (e === "none") return;
    candidates.push({ key: `ex_${e}`, label: EXERCISE_LABEL[e as keyof typeof EXERCISE_LABEL] ?? e, category: "exercise",
      pred: same("exercise", l => l.exerciseType === e) });
  });
  candidates.push({ key: "sweat_high", label: "땀이 많은 운동", category: "exercise", pred: same("exercise", l => l.exerciseMeta.sweat === "high") });
  candidates.push({ key: "env_outdoor", label: "야외 운동", category: "environment", pred: same("exercise", l => l.exerciseMeta.environment === "outdoor") });
  candidates.push({ key: "env_indoor", label: "실내 운동", category: "environment", pred: same("exercise", l => l.exerciseMeta.environment === "indoor") });

  // Context factors
  const ctxSet = new Set<string>();
  logsUsed.forEach(l => { if (!isDefault(l, "context")) l.contextFactors.forEach(c => ctxSet.add(c)); });
  ctxSet.forEach(c => {
    if (c === "none") return;
    candidates.push({ key: `ctx_${c}`, label: CONTEXT_LABEL[c as keyof typeof CONTEXT_LABEL] ?? c, category: "context",
      pred: same("context", l => l.contextFactors.includes(c as ContextKey)) });
  });

  // 날씨: 절대 기준 대신 "내 기록 기간의 중간값보다 높거나 낮은 날"로 가른다 — 계절·지역이 달라도 같은 방식으로 비교할 수 있다.
  const wx = (pick: (w: NonNullable<DailyLog["weather"]>) => number | undefined) => logsUsed.map(l => (l.weather ? pick(l.weather) : undefined)).filter((v): v is number => typeof v === "number");
  const median = (v: number[]) => { const a = [...v].sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : NaN; };
  const humidities = wx(w => w.humidity), uvs = wx(w => w.uv), temps = wx(w => w.temp), pms = wx(w => w.pm25);
  const weatherCandidate = (key: string, label: string, values: number[], test: (w: NonNullable<DailyLog["weather"]>, m: number) => boolean | null) => {
    if (values.length < 6) return;
    const m = median(values);
    candidates.push({ key, label, category: "weather", pred: e => (e.log.weather ? test(e.log.weather, m) : null) });
  };
  weatherCandidate("wx_dry", "평소보다 건조한 날", humidities, (w, m) => w.humidity < m);
  weatherCandidate("wx_uv_high", "평소보다 자외선이 센 날", uvs, (w, m) => w.uv > m);
  weatherCandidate("wx_cold", "평소보다 추운 날", temps, (w, m) => w.temp < m);
  weatherCandidate("wx_pm_high", "평소보다 미세먼지가 많은 날", pms, (w, m) => (typeof w.pm25 === "number" ? w.pm25 > m : null));

  const factors: LifestyleFactor[] = [];
  for (const c of candidates) {
    const withIt: number[] = [];
    const withoutIt: number[] = [];
    const withDates: string[] = [];
    const withoutDates: string[] = [];
    for (const e of scored) {
      const hit = c.pred(e);
      if (hit === null) continue;
      if (hit) { withIt.push(e.score); withDates.push(e.log.date); }
      else { withoutIt.push(e.score); withoutDates.push(e.log.date); }
    }
    if (withIt.length < MIN_DAYS_PER_GROUP || withoutIt.length < MIN_DAYS_PER_GROUP) continue;
    const withAvg = withIt.reduce((x, y) => x + y, 0) / withIt.length;
    const withoutAvg = withoutIt.reduce((x, y) => x + y, 0) / withoutIt.length;
    const diff = withAvg - withoutAvg;
    if (!opts.includeAll && Math.abs(diff) < MIN_MEAN_DIFF) continue;
    const sameDirection = withIt.filter(v => (diff > 0 ? v > withoutAvg : v < withoutAvg)).length;
    const consistency = sameDirection / withIt.length;
    const nap = nonoverlapAllPairs(withIt, withoutIt);
    const strength = diff > 0 ? nap : 1 - nap;
    const confidence = withIt.length >= REPEATED_MIN_WITH_DAYS && strength >= REPEATED_MIN_NAP ? "repeated" : "reference";
    const est = estimateDifference(withIt, withoutIt, opts.priors?.[c.key] ?? DEFAULT_PRIOR);
    // 선행 연구 문구는 "있던 날 점수가 더 나쁘다"는 같은 방향일 때만 붙인다 — 반대 방향이면 문헌 근거처럼 보이지 않게 뺀다.
    const literature = diff > 0 ? c.literature : undefined;
    factors.push({ key: c.key, label: c.label, category: c.category, withDays: withIt.length, withoutDays: withoutIt.length, withAvg, withoutAvg, diff,
      shrunkDiff: est.shrunkDiff, ciLow: est.ciLow, ciHigh: est.ciHigh, clear: est.clear, se: est.se,
      withDates, withoutDates, consistency, nap, lagged: !!c.lagged, literature, confidence });
  }
  // 추정 범위가 0을 벗어난 요인 → 여러 날 반복 → 평균 차이가 큰 순서로
  factors.sort((x, y) =>
    (Number(y.clear) - Number(x.clear)) ||
    (Number(y.confidence === "repeated") - Number(x.confidence === "repeated")) ||
    Math.abs(y.diff) - Math.abs(x.diff));
  return opts.includeAll ? factors : factors.slice(0, 3);
}

export type RecoveryTypeKey =
  | "sleep_sensitive" | "emotion_reactive" | "travel_reactive" | "outdoor_reactive"
  | "exercise_heat" | "hormonal" | "routine_stable" | "weather_reactive" | "observation";

export interface RecoveryTypeResult { key: RecoveryTypeKey; label: string; desc: string; /** 추정 범위가 0을 포함하는 잠정 유형인가 — 유형 이름은 항상 붙이고, 확신 정도만 표시로 구분한다 */ tentative: boolean }

/**
 * 나의 유형. 사용자가 "그래서 나는 무슨 형인가"를 바로 알 수 있도록 1순위 요인이 있으면 항상 이름을 붙인다.
 * 다만 합성 사용자 시뮬레이션(docs/simulation.md)에서 효과가 없는 사용자의 대부분에게도 1순위 요인이 생겼으므로,
 * 추정 범위가 0을 포함하면 `tentative`로 표시해 "잠정"이라고 밝힌다.
 */
export function recoveryType(_session: RecoverySession, topFactors: LifestyleFactor[]): RecoveryTypeResult {
  const top = topFactors[0];
  const base = baseRecoveryType(top);
  const tentative = !!top && !top.clear;
  return { ...base, tentative, desc: tentative ? `${base.desc} 비교한 날이 아직 적어 잠정이에요.` : base.desc };
}

function baseRecoveryType(top: LifestyleFactor | undefined): { key: RecoveryTypeKey; label: string; desc: string } {
  if (!top) return { key: "observation", label: "기록 쌓는 중형", desc: "이번 7일은 같은 요인이 있던 날과 없던 날을 비교할 만큼 기록이 겹치지 않았어요. 다음 7일을 이어서 기록하면 유형이 나와요." };
  const desc = `${top.label}을(를) 기록한 ${top.withDays}일의 피부 불편 점수가 기록하지 않은 ${top.withoutDays}일보다 평균 ${Math.abs(top.diff).toFixed(1)}점 ${top.diff > 0 ? "높았어요" : "낮았어요"}. 함께 나타난 패턴이며 원인으로 단정할 수는 없어요.`;
  if (top.category === "sleep") return { key: "sleep_sensitive", label: "수면 동반형", desc };
  if (top.category === "emotion") return { key: "emotion_reactive", label: "감정 동반형", desc };
  if (top.category === "context") {
    if (top.key === "ctx_trip" || top.key === "ctx_longtravel") return { key: "travel_reactive", label: "이동·여행 동반형", desc };
    if (top.key === "ctx_outdoor") return { key: "outdoor_reactive", label: "야외활동 동반형", desc };
    if (top.key === "ctx_menstrual" || top.key === "cycle_pre" || top.key === "cycle_menstrual") return { key: "hormonal", label: "주기 동반형", desc };
  }
  if (top.category === "weather") return { key: "weather_reactive", label: "날씨 동반형", desc };
  if (top.category === "exercise" || top.category === "environment") return { key: "exercise_heat", label: "활동 동반형", desc };
  return { key: "routine_stable", label: "생활 리듬 동반형", desc };
}

export interface NextAction { title: string; steps: string[] }

/** 다음 7일에 "무엇을 하면 되는지"를 한 가지 실험으로 알려준다. 결과를 약속하지 않고, 같은 방식으로 다시 비교하는 것까지가 행동이다. */
export function nextAction(topFactors: LifestyleFactor[]): NextAction {
  const top = topFactors[0];
  const keepLogging = "피부 점수는 지금처럼 매일 기록하기";
  const recompare = "7일 뒤 이번 주와 같은 방식으로 비교하기";
  if (!top) return { title: "다음 7일은 매일 같은 시간에 기록해 보세요", steps: ["수면·감정·운동을 빠뜨리지 않고 기록하기", keepLogging, recompare] };
  if (top.category === "weather") return { title: "날씨와 피부 점수를 계속 같이 기록해 보세요", steps: ["같은 지역 기준으로 매일 기록하기", keepLogging, recompare] };
  const better = top.diff < 0; // 있던 날 점수가 낮았다 = 그 요인이 있는 날이 편했다
  return better
    ? { title: `${top.label}인 날을 늘려 보세요`, steps: [`7일 중 4일 이상 "${top.label}" 날 만들기`, keepLogging, recompare] }
    : { title: `${top.label}인 날을 줄여 보세요`, steps: [`7일 중 "${top.label}" 날을 2일 이하로 줄이기`, keepLogging, recompare] };
}

export interface ChangeHeadline { title: string; detail: string; direction: "better" | "worse" | "same" }

/** 이번 7일에 "무엇이 달라졌나"를 한 줄로. 가장 크게 내려간 고민을 앞세우고, 내려간 게 없으면 있는 그대로 말한다. 효과 판정이 아니라 기록 그대로의 변화다. */
export function changeHeadline(session: RecoverySession): ChangeHeadline | null {
  const results = concernResults(session);
  if (!results.length) return null;
  const best = results.reduce((a, b) => (b.delta > a.delta ? b : a));
  if (best.delta > 0) {
    const others = results.filter(r => r.key !== best.key && r.delta > 0).length;
    return { direction: "better", title: `${best.label} ${best.start}점 → ${best.end}점`, detail: `기록상 ${best.delta}점 낮아졌어요${others ? `. 다른 ${others}개 고민도 함께 내려갔어요` : ""}.` };
  }
  const worst = results.reduce((a, b) => (b.delta < a.delta ? b : a));
  if (worst.delta < 0) return { direction: "worse", title: `${worst.label} ${worst.start}점 → ${worst.end}점`, detail: `기록상 ${-worst.delta}점 올랐어요. 어떤 날에 올랐는지 아래에서 볼 수 있어요.` };
  return { direction: "same", title: "점수가 거의 그대로였어요", detail: "시작일과 마지막 날의 기록 점수가 같았어요." };
}

export interface NotableDay {
  date: string;
  score: number;
  /** 그날 기록한 항목 — 비교가 아니라 "그날 어땠는지"를 그대로 보여주기 위한 짧은 설명 */
  tags: string[];
}

/** 리포트 구간에서 불편 점수가 가장 낮았던 날과 가장 높았던 날. 요인 비교와 달리 날짜 2개를 그대로 보여줄 뿐 추정은 하지 않는다. 점수가 모두 같거나 2일 미만이면 null. */
export function bestAndWorstDays(session: RecoverySession): { best: NotableDay; worst: NotableDay } | null {
  const scored = reportLogs(session)
    .map(log => ({ log, score: dailyDiscomfort(log, session.selectedConcerns) }))
    .filter((x): x is { log: DailyLog; score: number } => x.score !== null);
  if (scored.length < 2) return null;
  const best = scored.reduce((a, b) => (b.score < a.score ? b : a));
  const worst = scored.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.score === worst.score) return null;
  const describe = ({ log, score }: { log: DailyLog; score: number }): NotableDay => {
    const tags: string[] = [`수면 ${Math.floor(log.sleepMinutes / 60)}시간${log.sleepMinutes % 60 ? ` ${log.sleepMinutes % 60}분` : ""}`];
    if (log.exerciseType !== "none") tags.push(EXERCISE_LABEL[log.exerciseType]);
    for (const e of log.emotions.slice(0, 2)) tags.push(EMOTION_LABEL[e]);
    for (const c of log.contextFactors) if (c !== "none") tags.push(CONTEXT_LABEL[c]);
    return { date: log.date, score: Math.round(score * 10) / 10, tags };
  };
  return { best: describe(best), worst: describe(worst) };
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
  if (top.category === "weather") return "다음 7일에도 같은 지역의 날씨와 피부 점수를 함께 기록해 이번 패턴이 반복되는지 확인해보세요.";
  if (top.category === "exercise" || top.category === "environment") return "운동한 날의 땀·열감과 피부 점수를 다음 주에도 함께 기록해보세요.";
  return `다음 7일에는 ${top.label}이(가) 있었던 날의 피부 점수를 다시 비교해보세요.`;
}

export function sleepMinutesFromTimes(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const start = bh * 60 + bm;
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

/** 리포트가 어떤 기록을 근거로 만들어졌는지 — 빠진 날도 숨기지 않고 보여준다. */
export function reportEvidence(session: RecoverySession) {
  const logs = reportLogs(session);
  const dates = logs.map(l => l.date);
  const scoredDays = logs.filter(l => dailyDiscomfort(l, session.selectedConcerns) !== null).length;
  return {
    loggedDays: logs.length,
    scoredDays,
    dates,
    skippedDates: skippedDatesBetween(dates),
    ampouleDays: logs.filter(l => l.ampouleUsed).length,
  };
}

/** 오늘 기록 직후 보여줄, "내 기록이 리포트에 어떻게 쌓이고 있는지" 한두 줄. */
export function dailyInsight(session: RecoverySession): { versusYesterday: string | null; evidence: string } {
  const logs = reportLogs(session);
  const today = logs[logs.length - 1];
  const prev = logs[logs.length - 2];
  let versusYesterday: string | null = null;
  if (today && prev) {
    const a = dailyDiscomfort(today, session.selectedConcerns);
    const b = dailyDiscomfort(prev, session.selectedConcerns);
    if (a !== null && b !== null) {
      const d = Math.round((b - a) * 10) / 10;
      versusYesterday = d > 0 ? `어제보다 불편 점수가 ${d}점 낮게 기록됐어요.`
        : d < 0 ? `어제보다 불편 점수가 ${-d}점 높게 기록됐어요.` : "어제와 같은 점수로 기록됐어요.";
    }
  }
  const n = logs.length;
  const comparable = lifestyleFactors(session).length;
  const evidence = n < 2
    ? "내일 기록이 쌓이면 어제와 오늘을 비교할 수 있어요."
    : n < 4
      ? `${n}일치 기록이 쌓였어요. 생활 요인 비교는 같은 요인이 있던 날과 없던 날이 2일 이상씩 모이면 시작돼요.`
      : comparable > 0
        ? `${n}일치 기록에서 비교할 수 있는 생활 요인이 ${comparable}개 보이기 시작했어요.`
        : `${n}일치 기록이 쌓였어요. 아직 뚜렷한 차이는 없어서, 내일 기록이 비교 기준을 더해줘요.`;
  return { versusYesterday, evidence };
}
