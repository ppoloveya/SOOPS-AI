import type { Prior } from "./estimate.ts";

/**
 * 고객 전체에서 사전 분포를 학습하는 순수 계산. 서버 스크립트(scripts/learn-priors.mjs)가 호출한다.
 * 개인정보가 아니라 "요인별 개인 추정 차이"만 입력으로 받는다.
 */

/** 한 요인에 대해 사용자 1명이 낸 추정. 사용자별로 하나씩만 넣는다. */
export interface UserFactorEstimate {
  diff: number;
  /** 그 사용자의 추정 표준오차 */
  se: number;
}

export interface PopulationPrior extends Prior {
  /** 이 사전 분포를 만든 사용자 수 */
  nUsers: number;
}

/** 이보다 적은 사용자로는 사전 분포를 공개하지 않는다 — 소수 사용자의 개인 패턴이 새어 나가는 것을 막는다. */
export const MIN_USERS_FOR_PRIOR = 30;
/** 학습된 사전 분포가 너무 좁아져 개인 기록을 무시하지 않도록 두는 표준편차 하한. */
export const MIN_PRIOR_SD = 0.3;

/**
 * 랜덤효과(DerSimonian–Laird) 방식으로 사용자 간 평균과 사용자 간 산포(tau)를 추정한다.
 * 반환하는 sd는 "새 사용자의 진짜 차이가 평균에서 얼마나 퍼져 있나"(tau)이며,
 * 사용자 수가 늘수록 mean 추정이 안정되고 새 고객의 초반 추정이 이 사전 분포에서 출발한다.
 */
export function learnPrior(estimates: UserFactorEstimate[]): PopulationPrior | null {
  const valid = estimates.filter(e => Number.isFinite(e.diff) && Number.isFinite(e.se) && e.se > 0);
  const k = valid.length;
  if (k < MIN_USERS_FOR_PRIOR) return null;

  const w = valid.map(e => 1 / e.se ** 2);
  const sumW = w.reduce((a, b) => a + b, 0);
  const fixedMean = valid.reduce((s, e, i) => s + w[i] * e.diff, 0) / sumW;
  const q = valid.reduce((s, e, i) => s + w[i] * (e.diff - fixedMean) ** 2, 0);
  const c = sumW - w.reduce((s, x) => s + x * x, 0) / sumW;
  const tau2 = Math.max(0, (q - (k - 1)) / c);

  const wr = valid.map(e => 1 / (e.se ** 2 + tau2));
  const sumWr = wr.reduce((a, b) => a + b, 0);
  const mean = valid.reduce((s, e, i) => s + wr[i] * e.diff, 0) / sumWr;
  const seMean = Math.sqrt(1 / sumWr);
  // 새 사용자의 참값은 mean ± tau 에 퍼져 있고, 평균 자체의 불확실성(seMean)도 더한다.
  const sd = Math.max(MIN_PRIOR_SD, Math.sqrt(tau2 + seMean ** 2));
  return { mean, sd, nUsers: k };
}
