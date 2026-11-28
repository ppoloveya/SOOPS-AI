/**
 * 합성 사용자 시뮬레이션 — 실제 고객 기록 대신 "정답을 아는 가짜 사용자"로 리포트 분석을 점검한다.
 *
 * 할 수 있는 것: 분석 로직이 (1) 실제로 있는 요인을 얼마나 찾고 (2) 아무 효과가 없을 때 얼마나 헛것을 보여주는지,
 * 기준값(최소 일수, NAP, 신뢰구간)을 바꾸면 그 비율이 어떻게 달라지는지 잰다.
 * 할 수 없는 것: 실제 사람들이 어떻게 기록하는지, 효과 크기가 얼마인지 알려주는 것. 사용자 행동·효과 크기는 이 파일의
 * 가정에서 나오므로, 여기서 나온 숫자는 "분석 로직의 성질"이지 "현실의 정확도"가 아니다. 이 결과를 고객 전체 사전 분포
 * (population_priors)에 넣어서는 안 된다.
 */
import type { ContextKey, DailyLog, EmotionKey, ExerciseKey, RecoverySession } from "./types.ts";
import { EMOTION_SCORE, EXERCISE_META } from "./types.ts";
import { sleepCategoryFrom } from "./analysis.ts";

/** 재현 가능한 난수(mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, normal };
}

/** 정답이 되는 요인. 값은 "있던 날 점수가 올라가는 폭(점)". */
export type TrueEffects = Partial<Record<"sleep_under6" | "sleep_under6_prev" | "tension_high" | "ctx_alcohol" | "sweat_high", number>>;

export interface Persona {
  id: string;
  /** 시작 점수(0~10) */
  baseline: number;
  /** 하루당 자연 회복 기울기(점/일, 음수=좋아짐) */
  trend: number;
  /** 하루 점수의 무작위 흔들림(표준편차) */
  noiseSd: number;
  /** 어제의 흔들림이 오늘로 이어지는 정도(0~1) */
  phi: number;
  effects: TrueEffects;
  /** 짧게 자는 날의 확률 */
  pShortSleep: number;
  /** 긴장·부정 감정이 높은 날의 확률 */
  pTension: number;
  pAlcohol: number;
  pSweat: number;
}

export type PersonaKind = "null" | "weak" | "moderate" | "strong";
const EFFECT_SIZE: Record<PersonaKind, number> = { null: 0, weak: 0.8, moderate: 1.5, strong: 2.5 };
const EFFECT_KEYS = ["sleep_under6", "sleep_under6_prev", "tension_high", "ctx_alcohol", "sweat_high"] as const;

/** 30명(기본) 다양한 가상 사용자. kind 비율: 효과 없음 1/3, 약함 1/6, 중간 1/3, 강함 1/6. */
export function makePersonas(count = 30, seed = 7): { persona: Persona; kind: PersonaKind }[] {
  const r = rng(seed);
  const kinds: PersonaKind[] = ["null", "moderate", "weak", "null", "moderate", "strong"];
  const out: { persona: Persona; kind: PersonaKind }[] = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    const effects: TrueEffects = {};
    if (kind !== "null") {
      const key = EFFECT_KEYS[Math.floor(r.next() * EFFECT_KEYS.length)];
      effects[key] = EFFECT_SIZE[kind];
    }
    out.push({
      kind,
      persona: {
        id: `p${String(i + 1).padStart(2, "0")}`,
        baseline: 4 + r.next() * 4,
        trend: -0.25 * r.next(),
        noiseSd: 0.7 + r.next() * 1.3,
        phi: r.next() * 0.5,
        effects,
        pShortSleep: 0.2 + r.next() * 0.3,
        pTension: 0.2 + r.next() * 0.3,
        pAlcohol: 0.05 + r.next() * 0.2,
        pSweat: 0.1 + r.next() * 0.3,
      },
    });
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isoDay = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString().slice(0, 10);

/** 한 사용자의 days일치 기록을 만든다. 점수는 0~10 정수로 반올림해 사람이 실제로 누르는 방식을 흉내 낸다. */
export function simulateLogs(p: Persona, days: number, seed: number): DailyLog[] {
  const r = rng(seed);
  const logs: DailyLog[] = [];
  let noise = 0;
  let prevShort = false;
  for (let d = 0; d < days; d++) {
    const short = r.next() < p.pShortSleep;
    const tension = r.next() < p.pTension;
    const alcohol = r.next() < p.pAlcohol;
    const sweaty = r.next() < p.pSweat;
    const sleepMinutes = short ? 270 + Math.floor(r.next() * 80) : 400 + Math.floor(r.next() * 100);
    const emotions: EmotionKey[] = tension ? ["stressed"] : ["calm"];
    const exerciseType: ExerciseKey = sweaty ? "running" : r.next() < 0.5 ? "walking" : "none";
    const contextFactors: ContextKey[] = alcohol ? ["alcohol"] : ["none"];

    noise = p.phi * noise + p.noiseSd * r.normal();
    const e = p.effects;
    const signal =
      (short ? e.sleep_under6 ?? 0 : 0) +
      (prevShort ? e.sleep_under6_prev ?? 0 : 0) +
      (tension ? e.tension_high ?? 0 : 0) +
      (alcohol ? e.ctx_alcohol ?? 0 : 0) +
      (sweaty ? e.sweat_high ?? 0 : 0);
    const score = clamp(Math.round(p.baseline + p.trend * d + signal + noise), 0, 10);
    prevShort = short;

    logs.push({
      day: d + 1,
      date: isoDay(d),
      concernScores: { redness: score },
      ampouleUsed: true,
      bedtime: "23:30",
      wakeTime: "07:00",
      sleepMinutes,
      sleepCategory: sleepCategoryFrom(sleepMinutes),
      emotions,
      emotionStressScore: emotions.reduce((s, k) => s + EMOTION_SCORE[k], 0),
      exerciseType,
      exerciseMeta: EXERCISE_META[exerciseType],
      contextFactors,
    });
  }
  return logs;
}

export function sessionFrom(p: Persona, logs: DailyLog[]): RecoverySession {
  return {
    version: 1, id: p.id, startedAt: logs[0]?.date ?? "2026-11-01", plantName: "sim", skinType: "normal", sensitivity: 3,
    currentCondition: "same", showMenstrualFactor: false, selectedConcerns: ["redness"],
    baselineScores: { redness: logs[0]?.concernScores.redness ?? 5 },
    dailyLogs: logs, wateredDates: [], fertilizedDates: [], completed: false,
  };
}

/**
 * 어떤 보고 키가 어떤 정답 요인을 "맞힌 것"으로 칠지, 그리고 맞는 방향(+1: 있던 날 점수가 더 높음).
 * 같은 현상을 보는 짝 요인(예: 짧은 수면 ↔ 7시간 이상 수면)도 맞힌 것으로 센다.
 */
export const TRUTH_MATCH: Record<keyof TrueEffects, Record<string, 1 | -1>> = {
  sleep_under6: { sleep_under6: 1, sleep_over7: -1 },
  sleep_under6_prev: { sleep_under6_prev: 1 },
  tension_high: { tension_high: 1, emotion_stressed: 1, emotion_calm: -1 },
  ctx_alcohol: { ctx_alcohol: 1 },
  sweat_high: { sweat_high: 1, ex_running: 1 },
};
