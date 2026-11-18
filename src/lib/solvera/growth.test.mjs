import test from "node:test";
import assert from "node:assert/strict";
import { FERTILIZER_DAYS, MAX_GROWTH_XP, growthProgress } from "./growth.ts";

const dates = ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"];
const session = (count, wateredDates = [], fertilizedDates = []) => ({
  completed: count === 7,
  dailyLogs: dates.slice(0, count).map((date, index) => ({ date, day: index + 1 })),
  wateredDates,
  fertilizedDates,
});

test("fertilizer unlocks only on days 2, 4, and 6 after watering", () => {
  assert.deepEqual(FERTILIZER_DAYS, [2, 4, 6]);
  assert.equal(growthProgress(session(2), dates[1]).canFertilize, false);
  assert.equal(growthProgress(session(2, [dates[1]]), dates[1]).canFertilize, true);
  assert.equal(growthProgress(session(2, [dates[1]], [dates[1]]), dates[1]).canFertilize, false);
  assert.equal(growthProgress(session(3, [dates[2]]), dates[2]).canFertilize, false);
});

test("fertilizer awards 30 XP once without advancing the flower day", () => {
  const watered = growthProgress(session(2, [dates[1]]), dates[1]);
  const fertilized = growthProgress(session(2, [dates[1]], [dates[1], dates[1]]), dates[1]);
  assert.equal(watered.day, 2);
  assert.equal(fertilized.day, 2);
  assert.equal(fertilized.xp - watered.xp, 30);
});

test("maximum XP is 790 after all daily and fertilizer actions", () => {
  const result = growthProgress(session(7, dates, [dates[1], dates[3], dates[5]]), dates[6]);
  assert.equal(result.xp, MAX_GROWTH_XP);
  assert.equal(result.day, 7);
});
