import test from "node:test";
import assert from "node:assert/strict";
import { cumulativeSummary } from "./analysis.ts";
import { makePersonas, sessionFrom, simulateLogs } from "./simulate.ts";

const persona = makePersonas(30, 7).find(x => x.kind === "strong").persona;

test("under 14 scored days there is no cumulative report yet", () => {
  assert.equal(cumulativeSummary(sessionFrom(persona, simulateLogs(persona, 13, 1))), null);
});

test("14 days gives the first milestone, 28 days the cycle milestone", () => {
  const logs = simulateLogs(persona, 28, 2);
  const s14 = cumulativeSummary({ ...sessionFrom(persona, logs.slice(-7)), archivedLogs: logs.slice(14, 21) });
  assert.equal(s14.days, 14);
  assert.equal(s14.milestone, 14);
  const s28 = cumulativeSummary({ ...sessionFrom(persona, logs.slice(-7)), archivedLogs: logs.slice(0, 21) });
  assert.equal(s28.days, 28);
  assert.equal(s28.milestone, 28);
});

test("first and last week averages come from the first and last seven scored days", () => {
  const logs = simulateLogs(persona, 21, 3);
  const s = cumulativeSummary({ ...sessionFrom(persona, logs.slice(-7)), archivedLogs: logs.slice(0, 14) });
  const avg = rows => rows.reduce((a, l) => a + l.concernScores.redness, 0) / rows.length;
  assert.ok(Math.abs(s.firstWeekAvg - avg(logs.slice(0, 7))) < 1e-9);
  assert.ok(Math.abs(s.lastWeekAvg - avg(logs.slice(-7))) < 1e-9);
  assert.equal(typeof s.type.tentative, "boolean");
  assert.ok(s.type.label.length > 0);
});

test("overlapping dates between the archive and the current cycle are counted once", () => {
  const logs = simulateLogs(persona, 14, 4);
  const s = cumulativeSummary({ ...sessionFrom(persona, logs.slice(-7)), archivedLogs: logs });
  assert.equal(s.days, 14);
});
