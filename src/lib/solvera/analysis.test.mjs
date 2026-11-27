import test from "node:test";
import assert from "node:assert/strict";
import { concernResults, lifestyleFactors, nonoverlapAllPairs, overallChange } from "./analysis.ts";
import { estimateDifference } from "./estimate.ts";

const NONE_META = { intensity: "none", sweat: "none", environment: "none" };
const day = (n, date, score, over = {}) => ({
  day: n, date, concernScores: { redness: score }, ampouleUsed: true,
  bedtime: "23:00", wakeTime: "07:00", sleepMinutes: 480, sleepCategory: "overSeven",
  emotions: [], emotionStressScore: 0, exerciseType: "none", exerciseMeta: NONE_META, contextFactors: [], ...over,
});
const session = (logs, baseline = 5, extra = {}) => ({
  version: 1, id: "t", startedAt: "2026-11-01", plantName: "x", skinType: "normal", sensitivity: 3,
  currentCondition: "same", showMenstrualFactor: false, selectedConcerns: ["redness"],
  baselineScores: { redness: baseline }, dailyLogs: logs, wateredDates: [], fertilizedDates: [], completed: false, ...extra,
});

test("NAP counts ties as half and is 1 when groups do not overlap", () => {
  assert.equal(nonoverlapAllPairs([5, 6], [1, 2]), 1);
  assert.equal(nonoverlapAllPairs([3], [3]), 0.5);
  assert.equal(nonoverlapAllPairs([1, 2], [5, 6]), 0);
});

test("the estimate is shrunk toward zero with little data and tightens as data grows", () => {
  const few = estimateDifference([6, 7], [3, 4]);
  const many = estimateDifference([6, 7, 6, 7, 6, 7, 6, 7], [3, 4, 3, 4, 3, 4, 3, 4]);
  assert.ok(Math.abs(few.shrunkDiff) < Math.abs(few.diff));
  assert.ok(Math.abs(many.shrunkDiff) > Math.abs(few.shrunkDiff));
  assert.ok(many.ciHigh - many.ciLow < few.ciHigh - few.ciLow);
  assert.equal(many.clear, true);
});

test("a repeated, same-direction gap is marked repeated and keeps the sleep literature note", () => {
  const dates = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
  const poor = new Set([1, 3, 5]);
  const logs = dates.map((d, i) => poor.has(i)
    ? day(i + 1, d, 7, { sleepMinutes: 300, sleepCategory: "under5" })
    : day(i + 1, d, 3));
  const f = lifestyleFactors(session(logs)).find(x => x.key === "sleep_under6");
  assert.ok(f);
  assert.equal(f.confidence, "repeated");
  assert.deepEqual(f.withDates, ["2026-11-02", "2026-11-04", "2026-11-06"]);
  assert.ok(f.literature);
});

test("a gap in the opposite direction never carries the literature note", () => {
  const logs = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((d, i) =>
    i % 2 === 0 ? day(i + 1, d, 7) : day(i + 1, d, 3, { sleepMinutes: 300, sleepCategory: "under5" }));
  const f = lifestyleFactors(session(logs)).find(x => x.key === "sleep_under6");
  assert.ok(f);
  assert.ok(f.diff < 0);
  assert.equal(f.literature, undefined);
});

test("previous-day factors skip days whose previous day was not logged", () => {
  const logs = [
    day(1, "2026-11-01", 3, { sleepMinutes: 300, sleepCategory: "under5" }),
    day(2, "2026-11-02", 7),
    day(3, "2026-11-04", 3),
    day(4, "2026-11-05", 3, { sleepMinutes: 300, sleepCategory: "under5" }),
    day(5, "2026-11-06", 7),
    day(6, "2026-11-07", 3),
  ];
  const f = lifestyleFactors(session(logs)).find(x => x.key === "sleep_under6_prev");
  assert.ok(f);
  assert.deepEqual(f.withDates, ["2026-11-02", "2026-11-06"]);
  assert.deepEqual(f.withoutDates, ["2026-11-05", "2026-11-07"]);
  assert.ok(!f.withoutDates.includes("2026-11-01"));
});

test("archived earlier cycles add comparison days without changing the report window", () => {
  const archived = ["2026-10-20", "2026-10-21", "2026-10-22"].map((d, i) =>
    i === 1 ? day(i + 1, d, 7, { sleepMinutes: 300, sleepCategory: "under5" }) : day(i + 1, d, 3));
  const now = ["2026-11-01", "2026-11-02"].map((d, i) => day(i + 1, d, 3));
  const f = lifestyleFactors(session(now, 5, { archivedLogs: archived }));
  assert.equal(f.length, 0); // 있던 날이 1일뿐이라 아직 비교하지 않음
  const more = lifestyleFactors(session([...now, day(3, "2026-11-03", 7, { sleepMinutes: 300, sleepCategory: "under5" })], 5, { archivedLogs: archived }));
  assert.ok(more.some(x => x.key === "sleep_under6" && x.withDays === 2));
});

test("meaningful change uses about 2 points or 30% on the recent two-day average", () => {
  const big = concernResults(session([day(1, "2026-11-01", 4), day(2, "2026-11-02", 3), day(3, "2026-11-03", 3)], 6));
  assert.equal(big[0].meaningful, true);
  const small = concernResults(session([day(1, "2026-11-01", 5), day(2, "2026-11-02", 5), day(3, "2026-11-03", 5)], 6));
  assert.equal(small[0].meaningful, false);
});

test("trouble scores that rise in the 7 days before a recorded period appear as the pre-menstrual factor with its literature note", () => {
  // 시작일 09-01, 09-29(주기 28일) → 생리 전 7일은 09-22~09-28, 10-20~10-26
  const dates = [];
  for (let d = 2; d <= 28; d++) dates.push(`2026-09-${String(d).padStart(2, "0")}`);
  const pre = new Set(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]);
  const logs = dates.map((d, i) => day(i + 1, d, pre.has(d) ? 7 : 3));
  const f = lifestyleFactors(session(logs, 5, { periodStarts: ["2026-09-01", "2026-09-29"] })).find(x => x.key === "cycle_pre");
  assert.ok(f);
  assert.equal(f.withDays, 7);
  assert.ok(f.diff > 3);
  assert.ok(f.literature);
  assert.equal(f.confidence, "repeated");
});

test("without recorded period starts there is no cycle factor", () => {
  const logs = ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map((d, i) => day(i + 1, d, 3));
  assert.equal(lifestyleFactors(session(logs)).some(x => x.key.startsWith("cycle_")), false);
});

test("analysis uses the whole continuous history, not just the last completed 7 days", () => {
  const logs = Array.from({ length: 30 }, (_, i) => day(i + 1, `2026-10-${String(i + 1).padStart(2, "0")}`, i % 2 ? 7 : 3, i % 2 ? { sleepMinutes: 300, sleepCategory: "under5" } : {}));
  const f = lifestyleFactors(session(logs)).find(x => x.key === "sleep_under6");
  assert.ok(f);
  assert.equal(f.withDays, 15);
});

test("fields the customer never mentioned (default) are excluded from every comparison", () => {
  // 수면을 말하지 않아 기본값(6~7시간)으로 채워진 날들 — 짧은 수면 요인으로 잡히면 안 된다.
  const logs = Array.from({ length: 10 }, (_, i) => day(i + 1, `2026-11-${String(i + 1).padStart(2, "0")}`, i % 2 ? 7 : 3, {
    sleepMinutes: i % 2 ? 300 : 450, sleepCategory: i % 2 ? "under5" : "overSeven", sources: { sleep: "default" },
  }));
  assert.equal(lifestyleFactors(session(logs)).some(f => f.key.startsWith("sleep_")), false);
  const confirmed = logs.map(l => ({ ...l, sources: { sleep: "user" } }));
  assert.ok(lifestyleFactors(session(confirmed)).some(f => f.key === "sleep_under6"));
});

test("previous-day factors also skip a previous day whose value was a default", () => {
  const short = { sleepMinutes: 300, sleepCategory: "under5" };
  const logs = [
    day(1, "2026-11-01", 3, { ...short, sources: { sleep: "default" } }), // 기본값이라 다음 날(11-02)은 비교에서 제외
    day(2, "2026-11-02", 7),
    day(3, "2026-11-03", 3, short), day(4, "2026-11-04", 7),
    day(5, "2026-11-05", 3, short), day(6, "2026-11-06", 7),
    day(7, "2026-11-07", 3), day(8, "2026-11-08", 3), day(9, "2026-11-09", 3),
  ];
  const f = lifestyleFactors(session(logs)).find(x => x.key === "sleep_under6_prev");
  assert.ok(f);
  assert.deepEqual(f.withDates, ["2026-11-04", "2026-11-06"]);
  assert.ok(!f.withDates.includes("2026-11-02") && !f.withoutDates.includes("2026-11-02"));
});

test("old records without source info are treated as customer-entered", () => {
  const logs = Array.from({ length: 10 }, (_, i) => day(i + 1, `2026-11-${String(i + 1).padStart(2, "0")}`, i % 2 ? 7 : 3, {
    sleepMinutes: i % 2 ? 300 : 450, sleepCategory: i % 2 ? "under5" : "overSeven",
  }));
  assert.ok(lifestyleFactors(session(logs)).some(f => f.key === "sleep_under6"));
});

test("the overall verdict only says better or worse when the change is about 2 points or 30%", () => {
  const mk = (scores, baseline) => session(scores.map((v, i) => day(i + 1, `2026-11-${String(i + 1).padStart(2, "0")}`, v)), baseline);
  assert.equal(overallChange(mk([4, 3, 3], 7)).verdict, "better");
  assert.equal(overallChange(mk([6, 6, 6], 7)).verdict, "same");
  assert.equal(overallChange(mk([8, 9, 9], 5)).verdict, "worse");
  const o = overallChange(mk([4, 3, 3], 7));
  assert.equal(o.baseline, 7);
  assert.equal(o.recent, 3);
});
