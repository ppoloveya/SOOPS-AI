import test from "node:test";
import assert from "node:assert/strict";
import { completedChallengeLogs, currentStreak, hasCompletedChallenge } from "./streak.ts";

const logs = (...dates) => dates.map((date, index) => ({ date, day: index + 1 }));

test("seven different consecutive dates complete the challenge", () => {
  const entries = logs("2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04");
  assert.equal(currentStreak(entries, "2026-11-04"), 7);
  assert.equal(hasCompletedChallenge(entries), true);
  assert.deepEqual(completedChallengeLogs(entries).map(log => log.date), entries.map(log => log.date));
});

test("duplicates and a skipped day do not count as a seven-day run", () => {
  const entries = logs("2026-11-01", "2026-11-02", "2026-11-02", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08");
  assert.equal(currentStreak(entries, "2026-11-08"), 5);
  assert.equal(hasCompletedChallenge(entries), false);
});

test("a stale or future log cannot continue today's streak", () => {
  assert.equal(currentStreak(logs("2026-11-01"), "2026-11-04"), 0);
  assert.equal(currentStreak(logs("2026-11-05"), "2026-11-04"), 0);
  assert.equal(currentStreak(logs("2026-11-03"), "2026-11-04"), 1);
});

test("the report uses the latest completed run, not earlier broken days", () => {
  const entries = logs("2026-10-01", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07");
  assert.deepEqual(completedChallengeLogs(entries).map(log => log.date), entries.slice(1).map(log => log.date));
});
