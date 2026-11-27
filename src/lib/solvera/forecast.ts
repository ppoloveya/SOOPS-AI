import type { DailyLog } from "./types.ts";
import { periodPhase } from "./period.ts";
import { isDefault } from "./analysis.ts";
import { FLARE_RISE, FORECAST_MIN_DAYS, FORECAST_MIN_EVENTS, FORECAST_MIN_SKILL } from "./evidence.ts";

/**
 * 개인 맞춤 "내일 트러블이 올라올 가능성" 예측.
 * - 악화일: 트러블 점수가 직전 일주일 평균보다 FLARE_RISE(2점) 이상 오른 날.
 * - 모델: 전날까지의 기록으로 다음 날 악화 여부를 맞히는 L2 정규화 로지스틱 회귀(개인 기록으로 학습).
 * - 관문: 과거 기록을 하루씩 앞으로 가며 "그날까지로 학습 → 다음 날 예측 → 채점"(walk-forward)한 뒤,
 *   평소 악화 비율만 쓰는 기준 예측보다 Brier 점수가 충분히 낫지 않으면 예측을 보여주지 않는다.
 * 진단이나 예언이 아니라 자가 기록에 기반한 가능성이다.
 */

export type FeatureKey = "sleepShort" | "tension" | "sweatHigh" | "recentRise" | "sleepShortPrev" | "dry" | "uvHigh" | "pmHigh" | "preMenstrualNext";

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  sleepShort: "6시간 미만 수면",
  tension: "긴장·부정 감정",
  sweatHigh: "땀이 많은 운동",
  recentRise: "최근 며칠 점수가 오르는 흐름",
  sleepShortPrev: "이틀 전 6시간 미만 수면",
  dry: "평소보다 건조한 날씨",
  uvHigh: "평소보다 센 자외선",
  pmHigh: "평소보다 많은 미세먼지",
  preMenstrualNext: "내일이 생리 전 구간",
};
const KEYS = Object.keys(FEATURE_LABEL) as FeatureKey[];

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

interface Sample { date: string; x: number[]; y: 0 | 1 }

function mean(values: number[]): number { return values.reduce((a, b) => a + b, 0) / values.length; }

/** 하루하루의 트러블 점수와 악화일 여부. 연속된 날짜가 아닌 구간은 이어 붙이지 않는다. */
export function buildSamples(logs: DailyLog[], periodStarts?: readonly string[]): { samples: Sample[]; latest: number[] | null; latestDate: string | null; scored: number } {
  const byDate = new Map<string, DailyLog>();
  for (const log of logs) if (typeof log.concernScores.trouble === "number") byDate.set(log.date, log);
  const dates = [...byDate.keys()].sort();
  const score = (d: string) => byDate.get(d)!.concernScores.trouble as number;
  const med = (vals: number[]) => { const a = [...vals].sort((x, y) => x - y); return a.length >= 6 ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : NaN; };
  const all = [...byDate.values()];
  const mHum = med(all.flatMap(l => (l.weather ? [l.weather.humidity] : [])));
  const mUv = med(all.flatMap(l => (l.weather ? [l.weather.uv] : [])));
  const mPm = med(all.flatMap(l => (typeof l.weather?.pm25 === "number" ? [l.weather.pm25] : [])));
  const at = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

  const featuresOn = (date: string): number[] | null => {
    const n = dayNumber(date);
    const prior = [1, 2, 3, 4, 5, 6, 7].map(k => at(n - k)).filter(d => byDate.has(d)).map(score);
    if (prior.length < 3) return null; // 최근 일주일 중 3일 이상 기록이 있어야 "평소"를 알 수 있다
    const log = byDate.get(date)!;
    const prev2 = byDate.get(at(n - 1));
    const lastThree = [0, 1, 2].map(k => at(n - k)).filter(d => byDate.has(d)).map(score);
    return [
      !isDefault(log, "sleep") && log.sleepMinutes < 360 ? 1 : 0,
      !isDefault(log, "emotions") && log.emotionStressScore >= 2 ? 1 : 0,
      !isDefault(log, "exercise") && log.exerciseMeta.sweat === "high" ? 1 : 0,
      lastThree.length >= 2 ? Math.max(0, Math.min(1, (lastThree[0] - mean(lastThree.slice(1))) / 4)) : 0,
      prev2 && !isDefault(prev2, "sleep") && prev2.sleepMinutes < 360 ? 1 : 0,
      log.weather && log.weather.humidity < mHum ? 1 : 0,
      log.weather && log.weather.uv > mUv ? 1 : 0,
      typeof log.weather?.pm25 === "number" && log.weather.pm25 > mPm ? 1 : 0,
      periodPhase(at(n + 1), periodStarts) === "pre" ? 1 : 0,
    ];
  };

  const isFlare = (date: string): boolean | null => {
    const n = dayNumber(date);
    const prior = [1, 2, 3, 4, 5, 6, 7].map(k => at(n - k)).filter(d => byDate.has(d)).map(score);
    if (prior.length < 3) return null;
    return score(date) - mean(prior) >= FLARE_RISE;
  };

  const samples: Sample[] = [];
  for (const date of dates) {
    const next = at(dayNumber(date) + 1);
    if (!byDate.has(next)) continue;
    const x = featuresOn(date);
    const flare = isFlare(next);
    if (!x || flare === null) continue;
    samples.push({ date, x, y: flare ? 1 : 0 });
  }
  const latestDate = dates.length ? dates[dates.length - 1] : null;
  return { samples, latest: latestDate ? featuresOn(latestDate) : null, latestDate, scored: dates.length };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** L2 정규화 로지스틱 회귀(경사하강). w[0]은 절편. 정규화는 "특징이 점수를 크게 바꾸지 않는다"는 약한 사전 가정이다. */
export function fitLogistic(samples: Sample[], lambda = 1, iterations = 400, rate = 0.3): number[] {
  const d = KEYS.length + 1;
  const w = new Array(d).fill(0);
  const n = samples.length;
  for (let it = 0; it < iterations; it++) {
    const grad = new Array(d).fill(0);
    for (const s of samples) {
      const p = sigmoid(w[0] + s.x.reduce((a, v, j) => a + v * w[j + 1], 0));
      const err = p - s.y;
      grad[0] += err;
      for (let j = 0; j < KEYS.length; j++) grad[j + 1] += err * s.x[j];
    }
    for (let j = 0; j < d; j++) w[j] -= (rate / n) * (grad[j] + (j > 0 ? lambda * w[j] : 0));
  }
  return w;
}

const predict = (w: number[], x: number[]) => sigmoid(w[0] + x.reduce((a, v, j) => a + v * w[j + 1], 0));
const brier = (probs: number[], ys: number[]) => mean(probs.map((p, i) => (p - ys[i]) ** 2));

export type ForecastResult =
  | { status: "insufficient"; reason: string; haveDays: number; needDays: number; haveEvents: number; needEvents: number }
  | { status: "not-better"; reason: string; skill: number; testedDays: number }
  | { status: "ok"; probability: number; baseRate: number; skill: number; testedDays: number; drivers: { key: FeatureKey; label: string; effect: number }[]; forDate: string };

export function forecastFlare(logs: DailyLog[], opts: { periodStarts?: readonly string[] } = {}): ForecastResult {
  const { samples, latest, latestDate, scored } = buildSamples(logs, opts.periodStarts);
  const events = samples.filter(s => s.y === 1).length;
  const nonEvents = samples.length - events;
  if (samples.length < FORECAST_MIN_DAYS || events < FORECAST_MIN_EVENTS || nonEvents < FORECAST_MIN_EVENTS) {
    return {
      status: "insufficient",
      reason: "예측하려면 트러블 점수를 매일 기록한 날과, 점수가 올랐던 날이 모두 충분히 필요해요.",
      haveDays: samples.length, needDays: FORECAST_MIN_DAYS, haveEvents: Math.min(events, nonEvents), needEvents: FORECAST_MIN_EVENTS,
    };
  }

  // walk-forward 검증: i번째 표본은 i번째 이전 표본만으로 학습한 모델로 예측한다.
  const startAt = Math.max(Math.floor(samples.length / 2), FORECAST_MIN_EVENTS * 2);
  const modelProbs: number[] = [];
  const baseProbs: number[] = [];
  const ys: number[] = [];
  for (let i = startAt; i < samples.length; i++) {
    const train = samples.slice(0, i);
    const rate = (train.filter(s => s.y === 1).length + 1) / (train.length + 2); // 라플라스 보정
    modelProbs.push(predict(fitLogistic(train), samples[i].x));
    baseProbs.push(rate);
    ys.push(samples[i].y);
  }
  const skill = 1 - brier(modelProbs, ys) / Math.max(brier(baseProbs, ys), 1e-9);
  if (skill < FORECAST_MIN_SKILL) {
    return { status: "not-better", reason: "지금까지의 기록으로는 단순히 평소 비율을 말하는 것보다 더 잘 맞히지 못해요. 기록이 더 쌓이면 다시 확인해요.", skill, testedDays: ys.length };
  }
  if (!latest || !latestDate) {
    return { status: "insufficient", reason: "최근 기록이 있어야 내일을 예측할 수 있어요.", haveDays: scored, needDays: FORECAST_MIN_DAYS, haveEvents: Math.min(events, nonEvents), needEvents: FORECAST_MIN_EVENTS };
  }

  const w = fitLogistic(samples);
  const probability = predict(w, latest);
  const drivers = KEYS
    .map((key, j) => ({ key, label: FEATURE_LABEL[key], effect: w[j + 1] * latest[j] }))
    .filter(d => d.effect > 0.1)
    .sort((a, b) => b.effect - a.effect)
    .slice(0, 2);
  const baseRate = (events + 1) / (samples.length + 2);
  const forDate = new Date((dayNumber(latestDate) + 1) * DAY_MS).toISOString().slice(0, 10);
  return { status: "ok", probability, baseRate, skill, testedDays: ys.length, drivers, forDate };
}
