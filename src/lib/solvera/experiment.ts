/**
 * 내 실험. 에이전트가 "이번 주는 이 한 가지만 해보세요"라고 제안하고, 일주일 뒤 같은 방식으로 다시 비교한다.
 * 결과는 "내 기록에서 이렇게 보였다"일 뿐 원인이나 제품 효과를 판정하지 않는다(docs/product-effect-methodology.md).
 * 숫자는 모두 lifestyleFactors(분석 엔진)에서 오고, 이 파일은 상태와 문장만 만든다.
 */
import type { Experiment, RecoverySession } from "./types.ts";
import { lifestyleFactors, type LifestyleFactor } from "./analysis.ts";
import { EXPERIMENT_DAYS, normalizeExperiment } from "./experiment-shape.ts";

export { EXPERIMENT_DAYS, normalizeExperiment };

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 1순위 요인으로 실험을 시작한다. 있던 날 점수가 낮았으면 늘려 보고, 높았으면 줄여 본다. */
export function startExperiment(top: LifestyleFactor, today: string): Experiment {
  return {
    id: `${today}-${top.key}`,
    factorKey: top.key,
    label: top.label,
    direction: top.diff < 0 ? "more" : "less",
    startDate: today,
    days: EXPERIMENT_DAYS,
    doneDates: [],
  };
}

export interface ExperimentStatus {
  /** 오늘이 몇 일차인지(1부터). 끝난 뒤에는 days를 넘지 않는다 */
  dayNumber: number;
  ended: boolean;
  doneToday: boolean;
  doneCount: number;
}

export function experimentStatus(exp: Experiment, today: string): ExperimentStatus {
  const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${exp.startDate}T00:00:00Z`)) / DAY_MS);
  return {
    dayNumber: Math.min(Math.max(elapsed + 1, 1), exp.days),
    ended: elapsed >= exp.days,
    doneToday: exp.doneDates.includes(today),
    doneCount: exp.doneDates.length,
  };
}

/** "해봤어요" 표시. 실험 기간 안의 날짜만 받는다. */
export function markDone(exp: Experiment, date: string): Experiment {
  if (date < exp.startDate || date >= addDays(exp.startDate, exp.days)) return exp;
  return { ...exp, doneDates: [...new Set([...exp.doneDates, date])].sort() };
}

export function experimentTitle(exp: Pick<Experiment, "label" | "direction">): string {
  return exp.direction === "more" ? `${exp.label}인 날을 늘려 보기` : `${exp.label}인 날을 줄여 보기`;
}

export type ExperimentResult =
  | { kind: "not_enough"; loggedDays: number; doneCount: number; text: string }
  | { kind: "result"; withDays: number; withoutDays: number; withAvg: number; withoutAvg: number; diff: number; clear: boolean; expected: boolean; doneCount: number; text: string };

/**
 * 실험 기간(시작일부터 days일)의 기록만으로 같은 요인을 다시 비교한다.
 * expected: 실험이 기대한 방향(늘려 보기→있던 날 점수가 낮음, 줄여 보기→있던 날 점수가 높음)과 실제 차이가 같은가.
 */
export function experimentResult(session: RecoverySession, exp: Experiment): ExperimentResult {
  const end = addDays(exp.startDate, exp.days);
  const inWindow = session.dailyLogs.filter(l => l.date >= exp.startDate && l.date < end);
  const doneCount = exp.doneDates.length;
  const windowSession: RecoverySession = { ...session, dailyLogs: inWindow, archivedLogs: [], completed: false };
  const f = lifestyleFactors(windowSession, { includeAll: true }).find(x => x.key === exp.factorKey);
  if (!f) {
    return {
      kind: "not_enough", loggedDays: inWindow.length, doneCount,
      text: `이번 주 기록 ${inWindow.length}일로는 "${exp.label}"인 날과 아닌 날을 비교하기 어려워요. 하루씩 더 기록하면 비교할 수 있어요.`,
    };
  }
  const expected = exp.direction === "more" ? f.diff < 0 : f.diff > 0;
  const gap = `"${exp.label}"인 날 ${f.withDays}일 평균 ${f.withAvg.toFixed(1)}점, 아닌 날 ${f.withoutDays}일 평균 ${f.withoutAvg.toFixed(1)}점이었어요.`;
  const verdict = !expected
    ? "이번 주 기록에서는 기대한 방향의 차이가 보이지 않았어요. 다른 요인으로 해볼 수 있어요."
    : f.clear
      ? "기대한 방향으로 차이가 보였어요. 내 기록에서 그렇게 보였다는 뜻이고, 원인이라고는 말할 수 없어요."
      : "기대한 방향이지만 날이 적어 우연일 수 있어요. 한 번 더 해보면 더 분명해져요.";
  return { kind: "result", withDays: f.withDays, withoutDays: f.withoutDays, withAvg: f.withAvg, withoutAvg: f.withoutAvg, diff: f.diff, clear: f.clear, expected, doneCount, text: `${gap} ${verdict}` };
}
