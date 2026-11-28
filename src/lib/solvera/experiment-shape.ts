/** 실험 저장값 검증. storage.ts가 불러와 쓰므로 분석 코드(analysis.ts)를 가져오지 않는다(순환 방지). */
import type { Experiment } from "./types.ts";

export const EXPERIMENT_DAYS = 7;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 저장된 값이 실험 모양이면 그대로 쓰고, 아니면 버린다(이전 버전·손상된 저장값 대비). */
export function normalizeExperiment(raw: unknown): Experiment | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Partial<Experiment>;
  if (typeof e.id !== "string" || typeof e.factorKey !== "string" || typeof e.label !== "string") return undefined;
  if (e.direction !== "more" && e.direction !== "less") return undefined;
  if (typeof e.startDate !== "string" || !ISO.test(e.startDate)) return undefined;
  const days = typeof e.days === "number" && e.days >= 1 && e.days <= 28 ? Math.floor(e.days) : EXPERIMENT_DAYS;
  const doneDates = Array.isArray(e.doneDates) ? [...new Set(e.doneDates.filter((d): d is string => typeof d === "string" && ISO.test(d)))].sort() : [];
  return { id: e.id, factorKey: e.factorKey, label: e.label, direction: e.direction, startDate: e.startDate, days, doneDates };
}
