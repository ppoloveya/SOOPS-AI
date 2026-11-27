import test from "node:test";
import assert from "node:assert/strict";
import { cycleLength, nextPeriodStart, periodPhase, nextPreWindow, normalizeStarts } from "./period.ts";

const starts = ["2026-09-01", "2026-09-30", "2026-10-29"]; // 간격 29, 29

test("cycle length is the median of plausible gaps, with 28 as the fallback", () => {
  assert.equal(cycleLength(starts), 29);
  assert.equal(cycleLength(["2026-09-01"]), 28);
  assert.equal(cycleLength(["2026-09-01", "2026-09-05"]), 28); // 4일 간격은 주기가 아니라 입력 실수로 본다
});

test("phases follow the last start: menstrual first days, then mid, then the 7 days before the next start", () => {
  assert.equal(periodPhase("2026-10-29", starts), "menstrual");
  assert.equal(periodPhase("2026-11-02", starts), "menstrual");
  assert.equal(periodPhase("2026-11-03", starts), "mid");
  assert.equal(periodPhase("2026-11-20", starts), "pre"); // 다음 예정일 11-27 기준 7일 전의 첫날
  assert.equal(periodPhase("2026-11-19", starts), "mid");
});

test("dates before any recorded start, or long after the expected next start, are not classified", () => {
  assert.equal(periodPhase("2026-08-20", starts), null);
  assert.equal(periodPhase("2027-01-15", starts), null);
  assert.equal(periodPhase("not-a-date", starts), null);
});

test("the next pre-menstrual window ends the day before the expected start", () => {
  assert.equal(nextPeriodStart(starts), "2026-11-27");
  assert.deepEqual(nextPreWindow(starts), { from: "2026-11-20", to: "2026-11-26" });
  assert.equal(nextPreWindow([]), null);
});

test("invalid and duplicate dates are dropped", () => {
  assert.deepEqual(normalizeStarts(["2026-10-01", "2026-10-01", "oops", "2026-02-30"]), ["2026-10-01"]);
});
