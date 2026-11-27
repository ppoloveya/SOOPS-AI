import test from "node:test";
import assert from "node:assert/strict";
import { createPlantShareUrl, normalizePlantName, parsePlantSnapshot } from "./plantShare.ts";

test("old or empty plant names receive a safe default", () => {
  assert.equal(normalizePlantName(undefined), "나의 찔레꽃");
  assert.equal(normalizePlantName("   "), "나의 찔레꽃");
  assert.equal(normalizePlantName("  작은 꽃  "), "작은 꽃");
});

test("share links contain only the public plant snapshot", () => {
  const url = createPlantShareUrl("https://soopsai.vercel.app", { name: "봄이", day: 2, xp: 210 });
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/plant");
  assert.deepEqual([...parsed.searchParams.keys()].sort(), ["day", "name", "xp"]);
  assert.deepEqual(parsePlantSnapshot(Object.fromEntries(parsed.searchParams)), { name: "봄이", day: 2, xp: 210 });
});

test("invalid shared progress is rejected", () => {
  assert.equal(parsePlantSnapshot({ name: "봄이", day: "8", xp: "999" }), null);
  assert.equal(parsePlantSnapshot({ name: "봄이", day: "", xp: "10" }), null);
  assert.equal(parsePlantSnapshot({ name: "봄이", day: "2", xp: "NaN" }), null);
});

test("an optional gift token is carried in the link, and malformed tokens are dropped", () => {
  const token = "0123456789abcdef";
  const url = createPlantShareUrl("https://soopsai.vercel.app", { name: "봄이", day: 2, xp: 210, token });
  const parsed = new URL(url);
  assert.deepEqual([...parsed.searchParams.keys()].sort(), ["day", "name", "t", "xp"]);
  assert.deepEqual(parsePlantSnapshot(Object.fromEntries(parsed.searchParams)), { name: "봄이", day: 2, xp: 210, token });
  assert.deepEqual(parsePlantSnapshot({ name: "봄이", day: "2", xp: "210", t: "<script>" }), { name: "봄이", day: 2, xp: 210 });
  assert.equal(createPlantShareUrl("https://x.y", { name: "a", day: 1, xp: 1, token: "bad" }).includes("t="), false);
});
