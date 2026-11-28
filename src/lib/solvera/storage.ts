import { STORAGE_KEY, CURRENT_VERSION, type RecoverySession } from "./types.ts";
import { hasCompletedChallenge } from "./streak.ts";
import { normalizePlantName } from "./plantShare.ts";
import { normalizeStarts } from "./period.ts";
import { normalizeExperiment } from "./experiment-shape.ts";

export function loadSession(): RecoverySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

export function saveSession(session: RecoverySession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, version: CURRENT_VERSION }));
  } catch {}
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function migrate(data: any): RecoverySession | null {
  if (!data || typeof data !== "object") return null;
  // v1 baseline; keep legacy fields as-is on logs
  const session: RecoverySession = {
    version: CURRENT_VERSION,
    id: data.id || crypto.randomUUID(),
    startedAt: data.startedAt || new Date().toISOString(),
    plantName: normalizePlantName(data.plantName),
    skinType: data.skinType || "unknown",
    sensitivity: data.sensitivity ?? 3,
    currentCondition: data.currentCondition || "same",
    showMenstrualFactor: !!data.showMenstrualFactor,
    selectedConcerns: Array.isArray(data.selectedConcerns) ? data.selectedConcerns : [],
    baselineScores: data.baselineScores || {},
    dailyLogs: Array.isArray(data.dailyLogs) ? data.dailyLogs : [],
    wateredDates: Array.isArray(data.wateredDates) ? [...new Set<string>(data.wateredDates.filter((date: unknown): date is string => typeof date === "string"))] : [],
    fertilizedDates: Array.isArray(data.fertilizedDates) ? [...new Set<string>(data.fertilizedDates.filter((date: unknown): date is string => typeof date === "string"))] : [],
    archivedLogs: Array.isArray(data.archivedLogs) ? data.archivedLogs : [],
    cloudConsent: data.cloudConsent === true,
    // 이미 시작 점수까지 마친 이전 사용자는 프로필 단계를 거친 것으로 본다
    profileDone: data.profileDone === true || Object.keys(data.baselineScores || {}).length > 0,
    region: typeof data.region === "string" ? data.region : undefined,
    periodStarts: normalizeStarts(Array.isArray(data.periodStarts) ? data.periodStarts.filter((d: unknown): d is string => typeof d === "string") : []),
    experiment: normalizeExperiment(data.experiment),
    completed: hasCompletedChallenge(Array.isArray(data.dailyLogs) ? data.dailyLogs : []),
  };
  return session;
}

export function todayISO() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
