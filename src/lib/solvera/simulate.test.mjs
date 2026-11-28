import test from "node:test";
import assert from "node:assert/strict";
import { bestAndWorstDays, changeHeadline, lifestyleFactors, nextAction, recoveryType } from "./analysis.ts";
import { makePersonas, sessionFrom, simulateLogs } from "./simulate.ts";

test("personas and logs are reproducible from the seed", () => {
  const a = makePersonas(30, 7);
  const b = makePersonas(30, 7);
  assert.equal(a.length, 30);
  assert.deepEqual(a, b);
  assert.ok(a.filter(x => x.kind === "null").length >= 10);
  assert.deepEqual(simulateLogs(a[1].persona, 7, 99), simulateLogs(a[1].persona, 7, 99));
  assert.ok(simulateLogs(a[1].persona, 7, 99).every(l => l.concernScores.redness >= 0 && l.concernScores.redness <= 10));
});

test("with no true effect, most 7-day types are still shown but flagged tentative", () => {
  let reports = 0;
  let firm = 0;
  for (const [pi, { persona, kind }] of makePersonas(30, 7).entries()) {
    if (kind !== "null") continue;
    for (let rep = 0; rep < 40; rep++) {
      const s = sessionFrom(persona, simulateLogs(persona, 7, 1000 + pi * 97 + rep));
      const factors = lifestyleFactors(s);
      if (!factors.length) continue;
      reports++;
      const type = recoveryType(s, factors);
      assert.notEqual(type.label, "후보 관찰형");
      if (!type.tentative) firm++;
    }
  }
  assert.ok(reports > 200);
  // 이름은 항상 붙이되, 효과가 없는데 "확정"으로 나가는 비율은 막아야 한다(관문이 없으면 거의 100%).
  assert.ok(firm / reports < 0.4, `firm ${firm}/${reports}`);
});

test("a factor whose range includes zero still gets a type name, marked tentative, plus a concrete next action", () => {
  const factor = { key: "sleep_over7", label: "7시간 이상 수면", category: "sleep", withDays: 4, withoutDays: 3, diff: -1.4, clear: false };
  const p = makePersonas(1)[0].persona;
  const s = sessionFrom(p, simulateLogs(p, 7, 1));
  const type = recoveryType(s, [factor]);
  assert.equal(type.key, "sleep_sensitive");
  assert.equal(type.label, "수면 동반형");
  assert.equal(type.tentative, true);
  assert.match(type.desc, /잠정/);
  const action = nextAction([factor]);
  assert.match(action.title, /늘려/);
  assert.equal(action.steps.length, 3);
  assert.match(nextAction([{ ...factor, diff: 1.2, label: "전날 6시간 미만 수면" }]).title, /줄여/);
  assert.equal(nextAction([]).steps.length, 3);
});

test("the change headline leads with the concern that dropped most and says so plainly when nothing moved", () => {
  const p = makePersonas(1)[0].persona;
  const s = sessionFrom(p, simulateLogs(p, 7, 3));
  const dropped = { ...s, baselineScores: { redness: 9 }, dailyLogs: s.dailyLogs.map((l, i) => i === 6 ? { ...l, concernScores: { redness: 3 } } : l) };
  const head = changeHeadline(dropped);
  assert.equal(head.direction, "better");
  assert.match(head.title, /붉은기 9점 → 3점/);
  const flat = { ...s, baselineScores: { redness: 4 }, dailyLogs: s.dailyLogs.map((l, i) => i === 6 ? { ...l, concernScores: { redness: 4 } } : l) };
  assert.equal(changeHeadline(flat).direction, "same");
});

test("best and worst days report the extremes and stay descriptive", () => {
  const p = makePersonas(30, 7).find(x => x.kind === "strong").persona;
  const s = sessionFrom(p, simulateLogs(p, 7, 5));
  const r = bestAndWorstDays(s);
  assert.ok(r);
  assert.ok(r.best.score < r.worst.score);
  assert.ok(r.best.tags[0].startsWith("수면"));
  assert.equal(bestAndWorstDays({ ...s, dailyLogs: s.dailyLogs.slice(0, 1) }), null);
});
