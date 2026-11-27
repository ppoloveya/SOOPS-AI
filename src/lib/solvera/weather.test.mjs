import test from "node:test";
import assert from "node:assert/strict";
import { parseWeather, attachWeatherToSession, pastDaysNeeded, isRegionKey } from "./weather.ts";
import { lifestyleFactors } from "./analysis.ts";
import { forecastFlare } from "./forecast.ts";

const META = { intensity: "none", sweat: "none", environment: "none" };
const log = (date, trouble, extra = {}) => ({
  day: 1, date, concernScores: { trouble }, ampouleUsed: true, bedtime: "00:00", wakeTime: "07:00",
  sleepMinutes: 450, sleepCategory: "overSeven", emotions: [], emotionStressScore: 0, exerciseType: "none", exerciseMeta: META, contextFactors: [], ...extra,
});
const session = (dailyLogs, extra = {}) => ({
  version: 1, id: "t", startedAt: "2026-11-01", plantName: "x", skinType: "normal", sensitivity: 3, currentCondition: "same",
  showMenstrualFactor: false, selectedConcerns: ["trouble"], baselineScores: { trouble: 4 }, dailyLogs, wateredDates: [], fertilizedDates: [], completed: false, ...extra,
});

test("the API response becomes per-day values, daily PM2.5 is the hourly mean, and incomplete days are skipped", () => {
  const out = parseWeather(
    { time: ["2026-11-27", "2026-11-28", "2026-11-29"], uv_index_max: [2.8, 2.9, null], temperature_2m_mean: [10, 5.2, 4], relative_humidity_2m_mean: [89, 67, 60] },
    { time: ["2026-11-27T00:00", "2026-11-27T01:00", "2026-11-28T00:00"], pm2_5: [10, 20, 8] },
  );
  assert.deepEqual(out["2026-11-27"], { uv: 2.8, temp: 10, humidity: 89, pm25: 15 });
  assert.deepEqual(out["2026-11-28"], { uv: 2.9, temp: 5.2, humidity: 67, pm25: 8 });
  assert.equal(out["2026-11-29"], undefined);
});

test("weather is attached only to logs that lack it, and nothing changes means the same object comes back", () => {
  const s = session([log("2026-11-01", 3, { weather: { uv: 1, temp: 1, humidity: 1 } }), log("2026-11-02", 3)]);
  const next = attachWeatherToSession(s, { "2026-11-01": { uv: 9, temp: 9, humidity: 9 }, "2026-11-02": { uv: 2, temp: 3, humidity: 40 } });
  assert.deepEqual(next.dailyLogs[0].weather, { uv: 1, temp: 1, humidity: 1 });
  assert.deepEqual(next.dailyLogs[1].weather, { uv: 2, temp: 3, humidity: 40 });
  assert.equal(attachWeatherToSession(next, { "2026-11-02": { uv: 0, temp: 0, humidity: 0 } }), next);
  assert.equal(pastDaysNeeded(next, "2026-11-05"), null);
  assert.equal(pastDaysNeeded(session([log("2026-11-02", 3)]), "2026-11-05"), 3);
});

test("only known regions are accepted", () => {
  assert.equal(isRegionKey("seoul"), true);
  assert.equal(isRegionKey("atlantis"), false);
});

test("dry days that precede higher trouble scores show up as a weather factor", () => {
  const logs = Array.from({ length: 10 }, (_, i) => {
    const dry = i % 2 === 0;
    return log(`2026-11-${String(i + 1).padStart(2, "0")}`, dry ? 7 : 3, { weather: { uv: 3, temp: 8, humidity: dry ? 30 : 70 } });
  });
  const f = lifestyleFactors(session(logs)).find(x => x.key === "wx_dry");
  assert.ok(f);
  assert.ok(f.diff > 0);
  assert.equal(f.category, "weather");
});

test("the forecast still runs with weather columns present and stays honest on little data", () => {
  const logs = Array.from({ length: 12 }, (_, i) => log(`2026-11-${String(i + 1).padStart(2, "0")}`, 4, { weather: { uv: 3, temp: 8, humidity: 50 } }));
  assert.equal(forecastFlare(logs).status, "insufficient");
});
