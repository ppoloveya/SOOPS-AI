/**
 * 분석 기준과 그 근거. 숫자를 바꾸기 전에 docs/evidence-basis.md를 먼저 읽을 것.
 * "근거"로 표시된 값은 논문에서 온 값이고, "경험칙"은 작은 표본에서 과장하지 않으려고 정한 이 앱의 보수적 기준이다.
 */

/** 근거: Farrar 외 (2001) — 0~10 숫자 척도에서 약 2점 또는 약 30% 변화가 환자가 느끼는 의미 있는 변화에 해당(만성 통증 연구). 피부 불편 점수에 그대로 검증된 값은 아니다. */
export const MEANINGFUL_ABSOLUTE = 2;
export const MEANINGFUL_RELATIVE = 0.3;

/** 경험칙: 비교 그룹마다 최소 2일. 그보다 적으면 평균을 비교하지 않는다. */
export const MIN_DAYS_PER_GROUP = 2;
/** 경험칙: 평균 차이가 0.5점 미만이면 기록 오차 범위로 보고 표시하지 않는다. */
export const MIN_MEAN_DIFF = 0.5;
/** 경험칙: "여러 날 반복" 표시는 요인이 있던 날 3일 이상, 쌍 비교(NAP)에서 한쪽으로 75% 이상 쏠릴 때만. NAP는 단일사례연구에서 쓰는 비중복 지표(Parker & Vannest). */
export const REPEATED_MIN_WITH_DAYS = 3;
export const REPEATED_MIN_NAP = 0.75;

/**
 * 경험칙: 사전 분포 — "생활 요인이 점수를 바꾸는 폭은 대개 0 근처이고 ±1.5점을 넘는 경우는 드물다"는 약한 가정.
 * 기록이 적을 땐 차이를 0쪽으로 줄여 과장을 막고, 기록이 쌓일수록 관측 차이에 가까워진다(베이지안 축소).
 */
export const PRIOR_SD = 1.5;
/** 경험칙: 점수 표준편차를 구할 수 없을 만큼 기록이 적을 때 쓰는 보수적 값(0~10 척도의 일간 변동). */
export const FALLBACK_SD = 1.5;

/** 선행 연구 문구. 두 연구 모두 피부 장벽 회복(TEWL)을 측정했고 이 앱의 자가 점수와는 다른 결과 지표다. */
export const LITERATURE = {
  sleep: "수면의 질이 낮은 사람의 피부 장벽 회복이 더 느렸다는 보고가 있어요 (Oyetakin-White 2015, 연관성).",
  stress: "스트레스가 높은 시기에 피부 장벽 회복이 느려졌다는 보고가 있어요 (Garg 2001).",
  cycle: "생리 전에 트러블이 늘어난다는 보고가 있어요 (여성 400명 설문 44%, Stoll 2001 · 병변 수 기준 63%, Lucky 2004). 비율은 연구 방법에 따라 달라요.",
} as const;

/** 경험칙: 예측 관문. 점수 기록이 이만큼 쌓이고, 악화일·평온일이 각각 이만큼 있어야 예측을 시도하고, 과거 검증에서 기준 예측보다 이만큼 나아야 보여준다. */
export const FLARE_RISE = 2; // Farrar 2001의 "약 2점" 변화 폭을 악화 기준으로 재사용 (통증 척도 값이며 피부 점수에 검증되지 않음)
export const FORECAST_MIN_DAYS = 28;
export const FORECAST_MIN_EVENTS = 6;
export const FORECAST_MIN_SKILL = 0.05;
