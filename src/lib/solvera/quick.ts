import { currentStreak } from "./streak.ts";
import { normalizePlantName } from "./plantShare.ts";

/**
 * 10초 의식: 가입·동의 없이 "오늘 피부 어때요?"를 한 번 누르면 식물에 물이 가는 가장 가벼운 기록.
 * 건강 정보가 아니라 "오늘 기분 정도"의 한 번 탭이며, 이 기기에만 저장하고 서버로 보내지 않는다.
 * 정식 7일 기록(수면·감정·생활 요인)과는 별개이고, 부담 없이 매일 열 이유를 만드는 장치다.
 */
export const QUICK_LEVELS = [
  { level: 0, label: "편안해요", reply: "좋은 날의 기록도 소중해요. 이런 날이 쌓이면 무엇이 도움이 됐는지 보이기 시작해요." },
  { level: 1, label: "조금 신경 쓰여요", reply: "그럴 수 있어요. 오늘 한 번 눌러둔 게 내 패턴의 첫 점이에요." },
  { level: 2, label: "트러블이 올라왔어요", reply: "많이 신경 쓰였죠. 지금 이유를 몰라도 괜찮아요. 기록이 쌓이면 언제, 왜 그랬는지 보이기 시작해요." },
] as const;
export type QuickLevel = typeof QUICK_LEVELS[number]["level"];

/**
 * 10초 의식에서 고른 값을 정식 기록의 시작 점수 "제안"으로 바꾼다(0~10 척도).
 * 정확한 환산이 아니라 대략적인 출발점이며, 시작 점수 화면에서 고객이 바꿀 수 있다.
 */
export const QUICK_LEVEL_TO_SCORE: Record<QuickLevel, number> = { 0: 2, 1: 5, 2: 8 };

export interface QuickCheck { date: string; level: QuickLevel }

export const QUICK_KEY = "soopsai:quick";
/** 기기에 쌓아 두는 최대 일수. 가벼운 기록이라 약 석 달이면 충분하다. */
export const QUICK_MAX = 90;

const isLevel = (v: unknown): v is QuickLevel => v === 0 || v === 1 || v === 2;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** 같은 날 다시 누르면 마지막 선택으로 바꾼다(하루 한 번의 값). */
export function addQuickCheck(list: QuickCheck[], date: string, level: QuickLevel): QuickCheck[] {
  const rest = list.filter(c => c.date !== date);
  return [...rest, { date, level }].sort((a, b) => a.date.localeCompare(b.date)).slice(-QUICK_MAX);
}

/** 가벼운 기록으로 이어진 일수. 하루 쉬어가기 규칙은 정식 기록과 같다. */
export function quickStreak(list: QuickCheck[], today: string): number {
  return currentStreak(list, today);
}

export function loadQuick(): QuickCheck[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUICK_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((c): c is QuickCheck => c && isDate(c.date) && isLevel(c.level)) : [];
  } catch {
    return [];
  }
}

export function saveQuick(list: QuickCheck[]): void {
  try { localStorage.setItem(QUICK_KEY, JSON.stringify(list)); } catch { /* 저장 공간이 없어도 앱은 계속 쓸 수 있다 */ }
}

/**
 * 10초 의식에서 처음 심은 식물. 가입 없이도 이름을 지어주고, 이 기기에만 저장한다.
 * 정식 기록을 시작하면 이 이름이 그대로 이어진다.
 */
export interface QuickPlant { name: string; plantedOn: string }
export const QUICK_PLANT_KEY = "soopsai:quick-plant";

export function loadQuickPlant(): QuickPlant | null {
  try {
    const p = JSON.parse(localStorage.getItem(QUICK_PLANT_KEY) ?? "null");
    return p && typeof p.name === "string" && isDate(p.plantedOn) ? { name: normalizePlantName(p.name), plantedOn: p.plantedOn } : null;
  } catch {
    return null;
  }
}

export function saveQuickPlant(plant: QuickPlant): QuickPlant {
  const clean = { name: normalizePlantName(plant.name), plantedOn: plant.plantedOn };
  try { localStorage.setItem(QUICK_PLANT_KEY, JSON.stringify(clean)); } catch { /* 저장 공간이 없어도 앱은 계속 쓸 수 있다 */ }
  return clean;
}
