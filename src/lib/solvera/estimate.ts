import { FALLBACK_SD, PRIOR_SD } from "./evidence.ts";

export interface GroupEstimate {
  /** 관측된 평균 차이 (있던 날 − 없던 날) */
  diff: number;
  /** 기록이 적을수록 사전 분포 쪽으로 줄인 추정치 — 화면에는 이 값과 범위를 쓴다 */
  shrunkDiff: number;
  ciLow: number;
  ciHigh: number;
  /** 추정 범위가 0을 포함하지 않으면 true — 기록이 쌓이면서 처음으로 "차이가 있어 보인다"고 말할 수 있게 되는 지점 */
  clear: boolean;
  /** 관측 차이의 표준오차 — 고객 전체 학습(population.ts)의 입력 */
  se: number;
}

/** 사전 분포: 기본은 평균 0, 표준편차 PRIOR_SD. 동의한 고객 전체에서 학습한 값이 있으면 그 값으로 대체된다. */
export interface Prior {
  mean: number;
  sd: number;
}

export const DEFAULT_PRIOR: Prior = { mean: 0, sd: PRIOR_SD };

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 두 그룹의 합동 표준편차. 자유도가 모자라면 보수적 기본값을 쓴다. */
function pooledSd(a: number[], b: number[]): number {
  const df = a.length + b.length - 2;
  if (df < 1) return FALLBACK_SD;
  const ma = mean(a);
  const mb = mean(b);
  const ss = a.reduce((s, v) => s + (v - ma) ** 2, 0) + b.reduce((s, v) => s + (v - mb) ** 2, 0);
  const sd = Math.sqrt(ss / df);
  // 표본이 아주 작으면 우연히 편차가 0에 가까워질 수 있으므로 하한을 둔다.
  return Math.max(sd, FALLBACK_SD / 2);
}

/**
 * 정규-정규 켤레 사전분포로 평균 차이를 갱신한다.
 * 개인 기록이 적으면 사전 분포(고객 전체에서 학습한 값 또는 0)에 가깝고,
 * 기록 일수가 늘면 se가 줄어 개인 관측값이 우선하며 범위(ciLow~ciHigh)가 좁아진다.
 */
export function estimateDifference(withScores: number[], withoutScores: number[], prior: Prior = DEFAULT_PRIOR): GroupEstimate {
  const diff = mean(withScores) - mean(withoutScores);
  const se = pooledSd(withScores, withoutScores) * Math.sqrt(1 / withScores.length + 1 / withoutScores.length);
  const priorVar = Math.max(prior.sd, 0.05) ** 2;
  const dataVar = se ** 2;
  const precision = 1 / priorVar + 1 / dataVar;
  const shrunkDiff = (prior.mean / priorVar + diff / dataVar) / precision;
  const postSd = Math.sqrt(1 / precision);
  const ciLow = shrunkDiff - 1.96 * postSd;
  const ciHigh = shrunkDiff + 1.96 * postSd;
  return { diff, shrunkDiff, ciLow, ciHigh, clear: ciLow > 0 || ciHigh < 0, se };
}
