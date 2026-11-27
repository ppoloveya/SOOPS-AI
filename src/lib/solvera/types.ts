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
  // 주요 지표 우선순위: 생리 → (수면·스트레스는 별도 항목) → 운동 → 여행 → 음주 → 세안
  "menstrual","trip","longtravel","alcohol","skippedcleanse","latecleanse","outdoor","mask","newcosmetic","none",
] as const;
export type ContextKey = typeof CONTEXT_KEYS[number];
export const CONTEXT_LABEL: Record<ContextKey, string> = {
  longtravel:"장시간 이동", trip:"여행", outdoor:"야외활동", alcohol:"음주",
  menstrual:"생리 전·중", mask:"마스크 장시간", newcosmetic:"새로운 화장품",
  latecleanse:"늦은 클렌징", skippedcleanse:"세안을 깜빡함", none:"해당 없음",
};

/** 그날의 날씨(사는 지역 기준). uv=자외선 지수 일최대, temp=평균기온(℃), humidity=평균습도(%), pm25=초미세먼지 일평균(㎍/㎥) */
export interface WeatherDay { uv: number; temp: number; humidity: number; pm25?: number }

/** 기록의 각 항목이 어디서 왔는지: user=고객이 직접 입력·확인, default=말하지 않아 기본값으로 채움(분석·예측에서 제외) */
export type LogField = "sleep" | "emotions" | "exercise" | "context" | "ampoule";
export type FieldSource = "user" | "default";

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
  /** 자유 입력 "오늘 하루 한마디" — 감성 요약 전용, 상관관계 분석에는 사용하지 않음 */
  note?: string;
  /** 자유 입력에서 추출한 키워드 1개 — 감성 요약 전용 */
  noteKeyword?: string;
  /** 사는 지역을 고른 경우에만 붙는 그날의 날씨 */
  weather?: WeatherDay;
  /** 항목별 출처. 없으면(이전 기록·일반 폼) 모두 직접 입력으로 본다 */
  sources?: Partial<Record<LogField, FieldSource>>;
}


export interface RecoverySession {
  version: number;
  id: string;
  startedAt: string;
  plantName: string;
  skinType: SkinType;
  sensitivity: number;         // 1-5
  currentCondition: CurrentCondition;
  showMenstrualFactor: boolean;
  selectedConcerns: ConcernKey[];
  baselineScores: Partial<Record<ConcernKey, number>>;
  dailyLogs: DailyLog[];
  wateredDates: string[];
  fertilizedDates: string[];
  completed: boolean;
  /** 이전 7일 주기에서 이어받은 기록 — 분석에서만 쓰며 성장·챌린지 계산에는 섞지 않는다 */
  archivedLogs?: DailyLog[];
  /** 기록을 서버로 보내 개인 맞춤·고객 전체 학습에 쓰는 것에 별도로 동의했는지(선택, 기본 꺼짐) */
  cloudConsent?: boolean;
  /** 날씨 기록용으로 고른 시·도(선택). 정확한 위치는 쓰지 않는다 */
  region?: string;
  /** 생리 시작일(YYYY-MM-DD) 목록. 가장 민감한 정보라 이 기기에만 저장하고 서버로 보내지 않는다 */
  periodStarts?: string[];
  /** 선택 프로필(피부 타입·생리 항목·지역)을 마쳤는지. 처음 시작할 때는 묻지 않고 나중에 대시보드에서 묻는다 */
  profileDone?: boolean;
}

export const STORAGE_KEY = "solvera:session:v1";
export const CURRENT_VERSION = 1;
