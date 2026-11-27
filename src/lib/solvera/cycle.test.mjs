import test from "node:test";
import assert from "node:assert/strict";
import { startNextCycle, MAX_ARCHIVED_DAYS } from "./cycle.ts";

const log = (date, score) => ({ day: 1, date, concernScores: { redness: score } });
const base = (dailyLogs, extra = {}) => ({
  id: "old", startedAt: "2026-11-01", selectedConcerns: ["redness"], baselineScores: { redness: 8 },
  dailyLogs, wateredDates: ["2026-11-01"], fertilizedDates: ["2026-11-02"], completed: true, ...extra,
});

test("the next cycle keeps earlier logs for analysis but resets growth and the challenge", () => {
  const next = startNextCycle(base([log("2026-11-01", 6), log("2026-11-02", 4), log("2026-11-03", 3)]));
  assert.equal(next.dailyLogs.length, 0);
  assert.deepEqual(next.wateredDates, []);
  assert.deepEqual(next.fertilizedDates, []);
  assert.equal(next.completed, false);
  assert.equal(next.archivedLogs.length, 3);
  assert.notEqual(next.id, "old");
});

test("the new baseline continues from the last two days of the previous cycle", () => {
  const next = startNextCycle(base([log("2026-11-01", 6), log("2026-11-02", 4), log("2026-11-03", 2)]));
  assert.equal(next.baselineScores.redness, 3);
});

test("archived logs are merged by date and capped", () => {
  const archived = Array.from({ length: MAX_ARCHIVED_DAYS + 10 }, (_, i) => log(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), 5));
  const next = startNextCycle(base([log("2026-11-01", 6)], { archivedLogs: archived }));
  assert.equal(next.archivedLogs.length, MAX_ARCHIVED_DAYS);
  assert.equal(next.archivedLogs.at(-1).date, "2026-11-01");
});
