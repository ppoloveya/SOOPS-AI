import test from "node:test";
import assert from "node:assert/strict";
import { learnPrior, MIN_USERS_FOR_PRIOR } from "./population.ts";
import { estimateDifference } from "./estimate.ts";
import { toCloudRow } from "./cloud.ts";

const users = (n, diff, se = 1) => Array.from({ length: n }, (_, i) => ({ diff: diff + (i % 2 ? 0.3 : -0.3), se }));

test("no prior is published below the minimum number of users", () => {
  assert.equal(learnPrior(users(MIN_USERS_FOR_PRIOR - 1, 1)), null);
  assert.ok(learnPrior(users(MIN_USERS_FOR_PRIOR, 1)));
});

test("the learned prior centers on the population mean", () => {
  const prior = learnPrior(users(60, 1.2));
  assert.ok(Math.abs(prior.mean - 1.2) < 0.1);
  assert.equal(prior.nUsers, 60);
  assert.ok(prior.sd >= 0.3);
});

test("a learned prior sharpens a new customer's early estimate, and personal data still wins as it grows", () => {
  const prior = { mean: 1.5, sd: 0.5 };
  const withScores = [6, 7];
  const withoutScores = [6, 6];
  const flat = estimateDifference(withScores, withoutScores);
  const informed = estimateDifference(withScores, withoutScores, prior);
  assert.ok(informed.shrunkDiff > flat.shrunkDiff);
  assert.ok(informed.ciHigh - informed.ciLow < flat.ciHigh - flat.ciLow);
  const manyWith = Array(12).fill(3);
  const manyWithout = Array(12).fill(6);
  const personal = estimateDifference(manyWith, manyWithout, prior);
  assert.ok(personal.shrunkDiff < 0, "with enough personal data the sign follows the customer, not the population");
});

test("rows sent to the server never include notes or plant names", () => {
  const session = { skinType: "dry", sensitivity: 3, selectedConcerns: ["redness"], plantName: "비밀이름" };
  const log = {
    date: "2026-11-01", concernScores: { redness: 4 }, ampouleUsed: true, sleepMinutes: 420, emotions: ["calm"],
    emotionStressScore: 0, exerciseType: "none", contextFactors: [], note: "개인적인 메모", noteKeyword: "스트레스",
  };
  const json = JSON.stringify(toCloudRow("u1", session, log));
  assert.ok(!json.includes("개인적인 메모"));
  assert.ok(!json.includes("비밀이름"));
  assert.ok(!json.includes("스트레스"));
});
