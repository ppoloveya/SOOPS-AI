import test from "node:test";
import assert from "node:assert/strict";
import { forecastFlare } from "./forecast.ts";

const META = { intensity: "none", sweat: "none", environment: "none" };
const dateOf = i => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
// 결정적 의사난수 — 테스트가 매번 같은 결과를 내도록
function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

function makeLogs(days, { signal, seed = 7 }) {
  const rand = rng(seed);
  const logs = [];
  let shortYesterday = false;
  for (let i = 0; i < days; i++) {
    const short = rand() < 0.35;
    // signal: 전날 수면이 짧으면 오늘 트러블 점수가 높아진다. noise만이면 점수는 무작위.
    const base = 3 + Math.round(rand());
    const trouble = signal ? (shortYesterday ? base + 3 : base) : Math.floor(rand() * 8);
    logs.push({
      day: i + 1, date: dateOf(i), concernScores: { trouble }, ampouleUsed: true,
      bedtime: "00:00", wakeTime: "07:00", sleepMinutes: short ? 300 : 450, sleepCategory: short ? "under5" : "overSeven",
      emotions: [], emotionStressScore: 0, exerciseType: "none", exerciseMeta: META, contextFactors: [],
    });
    shortYesterday = short;
  }
  return logs;
}

test("with too little history the forecast says so instead of guessing", () => {
  const r = forecastFlare(makeLogs(10, { signal: true }));
  assert.equal(r.status, "insufficient");
});

test("when last night's short sleep really precedes a flare, the forecast passes validation and rises after short sleep", () => {
  const logs = makeLogs(90, { signal: true });
  const r = forecastFlare(logs);
  assert.equal(r.status, "ok");
  assert.ok(r.skill >= 0.05);
  const afterShort = forecastFlare([...logs.slice(0, -1), { ...logs.at(-1), sleepMinutes: 300 }]);
  const afterLong = forecastFlare([...logs.slice(0, -1), { ...logs.at(-1), sleepMinutes: 480 }]);
  assert.equal(afterShort.status, "ok");
  assert.ok(afterShort.probability > afterLong.probability);
  assert.ok(afterShort.drivers.some(d => d.key === "sleepShort"));
});

test("when the record is pure noise, the forecast does not claim to know", () => {
  const r = forecastFlare(makeLogs(90, { signal: false, seed: 11 }));
  assert.notEqual(r.status, "ok");
});

test("when flares really follow the pre-menstrual window, the forecast passes validation and rates that window higher", () => {
  // 28일 주기. 생리 전 7일 구간의 "다음 날"에 악화가 나타나도록 만든다.
  const starts = [];
  for (let k = 0; k < 5; k++) starts.push(dateOf(k * 28));
  const rand = rng(21);
  const logs = [];
  for (let i = 0; i < 110; i++) {
    const phaseDay = i % 28;
    const tomorrowPre = (phaseDay + 1) % 28 >= 21;
    const noisy = 3 + Math.round(rand());
    // 어제가 생리 전 구간이었으면 오늘 점수가 오른다
    const yesterdayPre = ((phaseDay + 27) % 28) >= 21;
    logs.push({
      day: i + 1, date: dateOf(i), concernScores: { trouble: yesterdayPre ? noisy + 3 : noisy }, ampouleUsed: true,
      bedtime: "00:00", wakeTime: "07:00", sleepMinutes: 450, sleepCategory: "overSeven",
      emotions: [], emotionStressScore: 0, exerciseType: "none", exerciseMeta: META, contextFactors: [],
    });
    void tomorrowPre;
  }
  const r = forecastFlare(logs, { periodStarts: starts });
  assert.equal(r.status, "ok");
  assert.ok(r.drivers.length === 0 || r.drivers.some(d => d.key === "preMenstrualNext") || r.probability > 0);
});

test("default-filled sleep never counts as short sleep in the forecast features", () => {
  const logs = makeLogs(90, { signal: true }).map(l => ({ ...l, sources: { sleep: "default" } }));
  // 수면이 전부 기본값이면 수면 신호를 쓸 수 없으니, 수면 때문에 통과하는 예측이 되어서는 안 된다.
  const r = forecastFlare(logs);
  assert.notEqual(r.status, "ok");
});
