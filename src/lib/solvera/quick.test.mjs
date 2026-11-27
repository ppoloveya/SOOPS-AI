import test from "node:test";
import assert from "node:assert/strict";
import { addQuickCheck, quickStreak, QUICK_LEVELS, QUICK_MAX } from "./quick.ts";

test("pressing again on the same day replaces that day's value", () => {
  let list = addQuickCheck([], "2026-11-01", 0);
  list = addQuickCheck(list, "2026-11-01", 2);
  assert.deepEqual(list, [{ date: "2026-11-01", level: 2 }]);
});

test("the streak follows the same one-skipped-day rule as the full record", () => {
  let list = [];
  for (const d of ["2026-11-01", "2026-11-02", "2026-11-04"]) list = addQuickCheck(list, d, 1);
  assert.equal(quickStreak(list, "2026-11-04"), 3);
  assert.equal(quickStreak(list, "2026-11-07"), 0);
});

test("only a bounded recent history is kept on the device", () => {
  let list = [];
  for (let i = 0; i < QUICK_MAX + 5; i++) list = addQuickCheck(list, new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), 1);
  assert.equal(list.length, QUICK_MAX);
});

test("replies never promise a result or a diagnosis", () => {
  for (const q of QUICK_LEVELS) assert.ok(!/진단|치료|개선|낫/.test(q.reply));
});

test("the 10-second tap becomes a rough starting-score suggestion that stays on the 0-10 scale", async () => {
  const { QUICK_LEVEL_TO_SCORE } = await import("./quick.ts");
  assert.deepEqual(Object.keys(QUICK_LEVEL_TO_SCORE).sort(), ["0", "1", "2"]);
  assert.ok(QUICK_LEVEL_TO_SCORE[0] < QUICK_LEVEL_TO_SCORE[1] && QUICK_LEVEL_TO_SCORE[1] < QUICK_LEVEL_TO_SCORE[2]);
  assert.ok(Object.values(QUICK_LEVEL_TO_SCORE).every(v => v >= 0 && v <= 10));
});

test("the plant name is cleaned the same way as in the full record", async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const { saveQuickPlant, loadQuickPlant } = await import("./quick.ts");
  assert.equal(loadQuickPlant(), null);
  assert.deepEqual(saveQuickPlant({ name: "  봄이  ", plantedOn: "2026-11-28" }), { name: "봄이", plantedOn: "2026-11-28" });
  assert.deepEqual(loadQuickPlant(), { name: "봄이", plantedOn: "2026-11-28" });
  assert.equal(saveQuickPlant({ name: "   ", plantedOn: "2026-11-28" }).name, "나의 찔레꽃");
  store.set("soopsai:quick-plant", "{broken");
  assert.equal(loadQuickPlant(), null);
  delete globalThis.localStorage;
});
