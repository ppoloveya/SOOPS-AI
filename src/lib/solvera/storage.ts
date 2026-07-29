import { STORAGE_KEY, CURRENT_VERSION, type RecoverySession } from "./types";

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
    skinType: data.skinType || "unknown",
    sensitivity: data.sensitivity ?? 3,
    currentCondition: data.currentCondition || "same",
    showMenstrualFactor: !!data.showMenstrualFactor,
    selectedConcerns: Array.isArray(data.selectedConcerns) ? data.selectedConcerns : [],
    baselineScores: data.baselineScores || {},
    dailyLogs: Array.isArray(data.dailyLogs) ? data.dailyLogs : [],
    completed: !!data.completed,
  };
  return session;
}

export function todayISO() { return new Date().toISOString().slice(0, 10); }
