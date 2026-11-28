// 합성 사용자 시뮬레이션: 리포트 분석이 진짜 요인을 얼마나 찾고, 효과가 없을 때 얼마나 헛것을 보여주는지 잰다.
// 실행: node scripts/simulate-report.mjs [--users 30] [--reps 300] [--seed 7]
// 주의: 사용자 행동과 효과 크기는 src/lib/solvera/simulate.ts의 가정이다. 결과는 "분석 로직의 성질"이며 현실의 정확도가 아니다.
import { lifestyleFactors } from "../src/lib/solvera/analysis.ts";
import { makePersonas, simulateLogs, sessionFrom, TRUTH_MATCH } from "../src/lib/solvera/simulate.ts";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const USERS = arg("users", 30);
const REPS = arg("reps", 300);
const SEED = arg("seed", 7);

// 리포트에 보여줄 요인을 고르는 규칙들. 첫 번째가 지금 앱의 동작이다.
const rules = {
  "지금 앱 (상위 3개)": (all, top3) => top3,
  "+ 추정 범위가 0 제외": (all, top3) => top3.filter(f => f.clear),
  "+ 여러 날 반복만": (all, top3) => top3.filter(f => f.confidence === "repeated"),
  "각 그룹 3일↑ + 범위 0 제외": (all) => all.filter(f => f.withDays >= 3 && f.withoutDays >= 3 && f.clear).slice(0, 3),
  "각 그룹 3일↑ + 반복 + 범위 0 제외": (all) => all.filter(f => f.withDays >= 3 && f.withoutDays >= 3 && f.clear && f.confidence === "repeated").slice(0, 3),
};

function isHit(factor, effects) {
  return Object.keys(effects).some(k => {
    const sign = TRUTH_MATCH[k][factor.key];
    return sign !== undefined && Math.sign(factor.diff) === sign;
  });
}

const personas = makePersonas(USERS, SEED);
const pct = x => `${(100 * x).toFixed(0)}%`;

for (const days of [7, 14, 28]) {
  const stats = Object.fromEntries(Object.keys(rules).map(n => [n, {
    nullRuns: 0, nullAny: 0, nullClaims: 0,
    effRuns: 0, effHit: 0, effClaims: 0, effFalse: 0,
    byKind: { weak: [0, 0], moderate: [0, 0], strong: [0, 0] },
  }]));
  personas.forEach(({ persona, kind }, pi) => {
    for (let rep = 0; rep < REPS; rep++) {
      const logs = simulateLogs(persona, days, SEED * 100003 + pi * 1009 + rep);
      const s = sessionFrom(persona, logs.slice(-7));
      if (days > 7) s.archivedLogs = logs.slice(0, -7);
      const all = lifestyleFactors(s, { includeAll: true });
      const top3 = lifestyleFactors(s);
      for (const [name, pick] of Object.entries(rules)) {
        const shown = pick(all, top3);
        const st = stats[name];
        if (kind === "null") {
          st.nullRuns++; st.nullClaims += shown.length; if (shown.length) st.nullAny++;
        } else {
          st.effRuns++; st.effClaims += shown.length;
          const hit = shown.some(f => isHit(f, persona.effects));
          if (hit) st.effHit++;
          st.effFalse += shown.filter(f => !isHit(f, persona.effects)).length;
          st.byKind[kind][0] += hit ? 1 : 0; st.byKind[kind][1]++;
        }
      }
    }
  });

  console.log(`\n=== 기록 ${days}일 (사용자 ${USERS}명 × ${REPS}회) ===`);
  console.log("규칙".padEnd(34) + "효과없음:헛것표시".padEnd(18) + "효과있음:찾음(약/중/강)".padEnd(28) + "리포트당 헛것 수");
  for (const [name, st] of Object.entries(stats)) {
    const k = st.byKind;
    const detail = `${pct(st.effHit / st.effRuns)} (${pct(k.weak[0] / k.weak[1])}/${pct(k.moderate[0] / k.moderate[1])}/${pct(k.strong[0] / k.strong[1])})`;
    const falsePerReport = (st.nullClaims + st.effFalse) / (st.nullRuns + st.effRuns);
    console.log(name.padEnd(34) + pct(st.nullAny / st.nullRuns).padEnd(18) + detail.padEnd(28) + falsePerReport.toFixed(2));
  }
}
