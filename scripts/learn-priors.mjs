// 동의한 고객 전체의 기록에서 요인별 사전 분포를 다시 학습해 population_priors 에 저장한다.
// 서비스 롤 키가 필요하므로 서버(예약 작업/CI 비밀값)에서만 실행한다. 브라우저 번들에 넣지 말 것.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/learn-priors.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { lifestyleFactors, sleepCategoryFrom } from "../src/lib/solvera/analysis.ts";
import { learnPrior } from "../src/lib/solvera/population.ts";
import { EXERCISE_META } from "../src/lib/solvera/types.ts";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요해요.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchAll(table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// 철회하지 않은 동의가 있는 사용자만 쓴다.
const consents = await fetchAll("skin_diary_consents", "user_id", q => q.is("withdrawn_at", null));
const consented = new Set(consents.map(c => c.user_id));
const logs = (await fetchAll("skin_diary_logs", "*")).filter(r => consented.has(r.user_id));

const byUser = new Map();
for (const r of logs) {
  if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
  byUser.get(r.user_id).push(r);
}

const perFactor = new Map(); // factor_key -> [{ diff, se }]
for (const rows of byUser.values()) {
  rows.sort((a, b) => a.log_date.localeCompare(b.log_date));
  const first = rows[0];
  const dailyLogs = rows.map((r, i) => ({
    day: i + 1,
    date: r.log_date,
    concernScores: r.concern_scores ?? {},
    ampouleUsed: r.ampoule_used,
    bedtime: "00:00",
    wakeTime: "00:00",
    sleepMinutes: r.sleep_minutes ?? 0,
    sleepCategory: sleepCategoryFrom(r.sleep_minutes ?? 0),
    emotions: r.emotions ?? [],
    emotionStressScore: r.emotion_stress_score ?? 0,
    exerciseType: r.exercise_type ?? "none",
    exerciseMeta: EXERCISE_META[r.exercise_type] ?? EXERCISE_META.none,
    contextFactors: r.context_factors ?? [],
  }));
  const session = {
    version: 1, id: first.user_id, startedAt: first.log_date, plantName: "", skinType: first.skin_type ?? "unknown",
    sensitivity: first.sensitivity ?? 3, currentCondition: "same", showMenstrualFactor: false,
    selectedConcerns: first.selected_concerns ?? [], baselineScores: {}, dailyLogs,
    wateredDates: [], fertilizedDates: [], completed: false,
  };
  // 사용자 1명당 요인별 "관측 차이"와 표준오차 1개씩. 사전 분포로 줄인 값이 아니라 관측값을 써서 순환을 피한다.
  for (const f of lifestyleFactors(session, { includeAll: true })) {
    if (!perFactor.has(f.key)) perFactor.set(f.key, []);
    perFactor.get(f.key).push({ diff: f.diff, se: f.se });
  }
}

const now = new Date().toISOString();
const rows = [];
for (const [factorKey, estimates] of perFactor) {
  const prior = learnPrior(estimates);
  if (prior) rows.push({ factor_key: factorKey, prior_mean: prior.mean, prior_sd: prior.sd, n_users: prior.nUsers, updated_at: now });
}

console.log(`동의 사용자 ${byUser.size}명 · 학습된 요인 ${rows.length}개 (사용자 30명 미만 요인은 제외)`);
for (const r of rows) console.log(`${r.factor_key}\tmean=${r.prior_mean.toFixed(2)}\tsd=${r.prior_sd.toFixed(2)}\tn=${r.n_users}`);
if (dryRun || !rows.length) process.exit(0);

const { error } = await supabase.from("population_priors").upsert(rows, { onConflict: "factor_key" });
if (error) throw new Error(error.message);
console.log("population_priors 를 갱신했어요.");
