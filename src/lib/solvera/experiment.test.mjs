import test from "node:test";
import assert from "node:assert/strict";
import { addDays, experimentResult, experimentStatus, experimentTitle, markDone, normalizeExperiment, startExperiment } from "./experiment.ts";

const NONE_META = { intensity: "none", sweat: "none", environment: "none" };
const log = (n, date, score, sleepMinutes) => ({
  day: n, date, concernScores: { redness: score }, ampouleUsed: true,
  bedtime: "23:00", wakeTime: "07:00", sleepMinutes, sleepCategory: sleepMinutes >= 420 ? "overSeven" : "under5",
  emotions: [], emotionStressScore: 0, exerciseType: "none", exerciseMeta: NONE_META, contextFactors: [],
});
const session = logs => ({
  version: 1, id: "t", startedAt: "2026-11-01", plantName: "x", skinType: "normal", sensitivity: 3,
  currentCondition: "same", showMenstrualFactor: false, selectedConcerns: ["redness"],
  baselineScores: { redness: 6 }, dailyLogs: logs, wateredDates: [], fertilizedDates: [], completed: false,
});
const START = "2026-11-01";
const week = fn => Array.from({ length: 7 }, (_, i) => fn(i, addDays(START, i)));
// 7시간 이상 잔 날(0,2,4,6)은 점수가 낮고, 짧게 잔 날은 높다
const slept = i => i % 2 === 0;
const sleepWeek = () => week((i, d) => log(i + 1, d, slept(i) ? 3 : 7, slept(i) ? 480 : 300));

const top = { key: "sleep_over7", label: "7시간 이상 수면", diff: -1.4 };

test("an experiment grows the factor that felt better and shrinks the one that felt worse", () => {
  const more = startExperiment(top, START);
  assert.equal(more.direction, "more");
  assert.equal(more.days, 7);
  assert.equal(experimentTitle(more), "7시간 이상 수면인 날을 늘려 보기");
  const less = startExperiment({ key: "tension_high", label: "긴장·부정 감정 높음", diff: 1.2 }, START);
  assert.equal(less.direction, "less");
  assert.equal(experimentTitle(less), "긴장·부정 감정 높음인 날을 줄여 보기");
});

test("done marks are unique and only count inside the experiment window", () => {
  let exp = startExperiment(top, START);
  exp = markDone(exp, "2026-11-02");
  exp = markDone(exp, "2026-11-02");
  exp = markDone(exp, "2026-10-31"); // 시작 전
  exp = markDone(exp, "2026-11-08"); // 7일째가 11-07이라 이미 끝난 뒤
  assert.deepEqual(exp.doneDates, ["2026-11-02"]);
});

test("status counts day numbers and ends after the seventh day", () => {
  const exp = markDone(startExperiment(top, START), "2026-11-03");
  assert.deepEqual(experimentStatus(exp, "2026-11-01"), { dayNumber: 1, ended: false, doneToday: false, doneCount: 1 });
  assert.equal(experimentStatus(exp, "2026-11-03").doneToday, true);
  assert.equal(experimentStatus(exp, "2026-11-07").dayNumber, 7);
  assert.equal(experimentStatus(exp, "2026-11-07").ended, false);
  assert.equal(experimentStatus(exp, "2026-11-08").ended, true);
  assert.equal(experimentStatus(exp, "2026-11-20").dayNumber, 7);
});

test("the result compares the same factor inside the window and never claims a cause", () => {
  const exp = startExperiment(top, START);
  const r = experimentResult(session(sleepWeek()), exp);
  assert.equal(r.kind, "result");
  assert.equal(r.expected, true);
  assert.equal(r.withDays, 4);
  assert.equal(r.withoutDays, 3);
  assert.ok(r.withAvg < r.withoutAvg);
  assert.match(r.text, /원인이라고는 말할 수 없어요|우연일 수 있어요/);
  assert.doesNotMatch(r.text, /덕분|때문에|효과가 있/);
});

test("an experiment run the wrong way round says the expected difference did not show", () => {
  const exp = { ...startExperiment(top, START), direction: "less" };
  const r = experimentResult(session(sleepWeek()), exp);
  assert.equal(r.kind, "result");
  assert.equal(r.expected, false);
  assert.match(r.text, /기대한 방향의 차이가 보이지 않았어요/);
});

test("logs outside the window are ignored, and too few days gives an honest not-enough", () => {
  const before = [log(0, "2026-10-30", 9, 480), log(0, "2026-10-31", 9, 480)];
  const two = [log(1, "2026-11-01", 3, 480), log(2, "2026-11-02", 7, 300)];
  const r = experimentResult(session([...before, ...two]), startExperiment(top, START));
  assert.equal(r.kind, "not_enough");
  assert.equal(r.loggedDays, 2);
  assert.match(r.text, /하루씩 더 기록/);
});

test("stored experiments are validated so a damaged value cannot break loading", () => {
  const good = { ...startExperiment(top, START), doneDates: ["2026-11-03", "2026-11-03", "nope"] };
  assert.deepEqual(normalizeExperiment(good).doneDates, ["2026-11-03"]);
  for (const bad of [null, undefined, 3, "x", {}, { ...good, direction: "sideways" }, { ...good, startDate: "yesterday" }]) {
    assert.equal(normalizeExperiment(bad), undefined);
  }
  assert.equal(normalizeExperiment({ ...good, days: 999 }).days, 7);
});
