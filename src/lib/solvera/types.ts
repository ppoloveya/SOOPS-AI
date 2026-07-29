export type SkinType = "dry" | "oily" | "combo" | "normal" | "unknown";
export type CurrentCondition = "worse" | "same" | "better";
export type SleepCategory = "under5" | "fiveToSix" | "sixToSeven" | "overSeven";

export const CONCERN_KEYS = [
  "redness", "heat", "dryness", "trouble", "shine", "pores", "texture", "makeup",
] as const;
export type ConcernKey = typeof CONCERN_KEYS[number];

export const CONCERN_LABEL: Record<ConcernKey, string> = {
  redness: "붉은기",
  heat: "열감",
  dryness: "건조함",
  trouble: "트러블",
  shine: "번들거림",
  pores: "모공",
  texture: "거친 피부결",
  makeup: "메이크업 들뜸",
};

export const EMOTION_KEYS = [
  "calm","fresh","energetic","satisfied","serene","normal",
  "tired","listless","sensitive","unfocused","stressed","anxious","stuffy","irritated","pressured",
] as const;
export type EmotionKey = typeof EMOTION_KEYS[number];

export const EMOTION_LABEL: Record<EmotionKey, string> = {
  calm: "편안함", fresh: "상쾌함", energetic: "활기참", satisfied: "만족스러움",
  serene: "차분함", normal: "평범함",
  tired: "피곤함", listless: "무기력함", sensitive: "예민함", unfocused: "집중 안 됨",
  stressed: "스트레스", anxious: "불안함", stuffy: "답답함", irritated: "짜증남", pressured: "압박감",
};
// score: 0 positive/stable, 1 fatigue/neutral, 2 tension/negative
export const EMOTION_SCORE: Record<EmotionKey, 0 | 1 | 2> = {
  calm: 0, fresh: 0, energetic: 0, satisfied: 0, serene: 0,
  normal: 1, tired: 1, listless: 1, unfocused: 1,
  sensitive: 2, stressed: 2, anxious: 2, stuffy: 2, irritated: 2, pressured: 2,
};

export const EXERCISE_KEYS = [
  "gym","running","walking","yoga","pilates","cycling","swimming","hiking","ballsports","none",
] as const;
export type ExerciseKey = typeof EXERCISE_KEYS[number];

export const EXERCISE_LABEL: Record<ExerciseKey, string> = {
  gym:"헬스", running:"러닝", walking:"걷기", yoga:"요가", pilates:"필라테스",
  cycling:"자전거", swimming:"수영", hiking:"등산", ballsports:"구기운동", none:"운동 안 함",
};
export type Intensity = "none"|"low"|"medium"|"high";
export type Sweat = "none"|"low"|"medium"|"high";
export type Environment = "none"|"indoor"|"outdoor"|"pool"|"mixed";
export interface ExerciseMeta { intensity: Intensity; sweat: Sweat; environment: Environment; }
export const EXERCISE_META: Record<ExerciseKey, ExerciseMeta> = {
  gym: { intensity:"high", sweat:"high", environment:"indoor" },
  running: { intensity:"high", sweat:"high", environment:"outdoor" },
  walking: { intensity:"low", sweat:"low", environment:"outdoor" },
  yoga: { intensity:"low", sweat:"medium", environment:"indoor" },
  pilates: { intensity:"medium", sweat:"medium", environment:"indoor" },
  cycling: { intensity:"medium", sweat:"high", environment:"outdoor" },
  swimming: { intensity:"medium", sweat:"low", environment:"pool" },
  hiking: { intensity:"high", sweat:"high", environment:"outdoor" },
  ballsports: { intensity:"high", sweat:"high", environment:"mixed" },
  none: { intensity:"none", sweat:"none", environment:"none" },
};

export const CONTEXT_KEYS = [
  "longtravel","trip","outdoor","alcohol","menstrual","mask","newcosmetic","latecleanse","none",
] as const;
export type ContextKey = typeof CONTEXT_KEYS[number];
export const CONTEXT_LABEL: Record<ContextKey, string> = {
  longtravel:"장시간 이동", trip:"여행", outdoor:"야외활동", alcohol:"음주",
  menstrual:"생리 전·중", mask:"마스크 장시간", newcosmetic:"새로운 화장품",
  latecleanse:"늦은 클렌징", none:"해당 없음",
};

export interface DailyLog {
  day: number;
  date: string; // ISO date
  concernScores: Partial<Record<ConcernKey, number>>;
  ampouleUsed: boolean;
  bedtime: string;      // "HH:MM"
  wakeTime: string;     // "HH:MM"
  sleepMinutes: number;
  sleepCategory: SleepCategory;
  emotions: EmotionKey[];
  emotionStressScore: number; // sum
  exerciseType: ExerciseKey;
  exerciseMeta: ExerciseMeta;
  contextFactors: ContextKey[];
}

export interface RecoverySession {
  version: number;
  id: string;
  startedAt: string;
  skinType: SkinType;
  sensitivity: number;         // 1-5
  currentCondition: CurrentCondition;
  showMenstrualFactor: boolean;
  selectedConcerns: ConcernKey[];
  baselineScores: Partial<Record<ConcernKey, number>>;
  dailyLogs: DailyLog[];
  completed: boolean;
}

export const STORAGE_KEY = "solvera:session:v1";
export const CURRENT_VERSION = 1;
