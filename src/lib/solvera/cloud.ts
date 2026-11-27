import type { DailyLog, RecoverySession } from "./types.ts";
import type { Prior } from "./estimate.ts";

/** 동의서 문구를 바꾸면 이 값도 올려서 다시 동의받는다. */
export const CONSENT_VERSION = "2026-11-28";

/** 서버로 보내는 한 행. 자유 입력 메모·식물 이름·기기 정보는 포함하지 않는다. */
export function toCloudRow(userId: string, session: RecoverySession, log: DailyLog) {
  return {
    user_id: userId,
    log_date: log.date,
    skin_type: session.skinType,
    sensitivity: session.sensitivity,
    selected_concerns: session.selectedConcerns,
    concern_scores: log.concernScores,
    ampoule_used: log.ampouleUsed,
    sleep_minutes: log.sleepMinutes,
    emotions: log.emotions,
    emotion_stress_score: log.emotionStressScore,
    exercise_type: log.exerciseType,
    context_factors: log.contextFactors,
    updated_at: new Date().toISOString(),
  };
}

// 자동 생성된 Supabase 타입에는 이 테이블들이 아직 없어서 최소한의 형태만 직접 선언한다.
interface Query { select: (c?: string) => Promise<{ data: unknown; error: { message: string } | null }>; }
interface Table {
  upsert: (rows: unknown, o?: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
  update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  select: Query["select"];
}
interface Client {
  from: (t: string) => Table;
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
    signInAnonymously: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  };
}

async function client(): Promise<Client> {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase as unknown as Client;
}

/** 로그인 없이 쓰도록 익명 계정을 쓴다. Supabase 대시보드에서 Anonymous sign-ins 를 켜야 한다. */
async function ensureUserId(c: Client): Promise<string> {
  const current = await c.auth.getUser();
  if (current.data.user) return current.data.user.id;
  const { data, error } = await c.auth.signInAnonymously();
  if (error || !data.user) throw new Error(error?.message ?? "익명 로그인에 실패했어요.");
  return data.user.id;
}

/** 동의를 기록한다. 이후 syncLogs 가 동작한다. */
export async function grantConsent(): Promise<void> {
  const c = await client();
  const userId = await ensureUserId(c);
  const { error } = await c.from("skin_diary_consents").upsert(
    { user_id: userId, consent_version: CONSENT_VERSION, consented_at: new Date().toISOString(), withdrawn_at: null },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

/** 동의 철회: 서버에 보낸 기록을 모두 삭제하고 철회 시각을 남긴다. 기기에 있는 기록은 그대로다. */
export async function withdrawConsent(): Promise<void> {
  const c = await client();
  const userId = await ensureUserId(c);
  const del = await c.from("skin_diary_logs").delete().eq("user_id", userId);
  if (del.error) throw new Error(del.error.message);
  const upd = await c.from("skin_diary_consents").update({ withdrawn_at: new Date().toISOString() }).eq("user_id", userId);
  if (upd.error) throw new Error(upd.error.message);
}

/** 현재 주기와 이어받은 이전 기록을 하루 한 행씩 올린다(같은 날짜는 덮어씀). */
export async function syncLogs(session: RecoverySession): Promise<void> {
  const logs = [...(session.archivedLogs ?? []), ...session.dailyLogs];
  if (!logs.length) return;
  const c = await client();
  const userId = await ensureUserId(c);
  const { error } = await c.from("skin_diary_logs").upsert(logs.map(log => toCloudRow(userId, session, log)), { onConflict: "user_id,log_date" });
  if (error) throw new Error(error.message);
}

/** 고객 전체에서 학습된 사전 분포. 아직 학습된 값이 없거나 읽지 못하면 빈 객체 — 앱은 기본 사전 분포로 동작한다. */
export async function fetchPopulationPriors(): Promise<Record<string, Prior>> {
  try {
    const c = await client();
    const { data, error } = await c.from("population_priors").select("factor_key,prior_mean,prior_sd");
    if (error || !Array.isArray(data)) return {};
    const priors: Record<string, Prior> = {};
    for (const row of data as { factor_key: string; prior_mean: number; prior_sd: number }[]) {
      if (Number.isFinite(row.prior_mean) && Number.isFinite(row.prior_sd) && row.prior_sd > 0) {
        priors[row.factor_key] = { mean: row.prior_mean, sd: row.prior_sd };
      }
    }
    return priors;
  } catch {
    return {};
  }
}
