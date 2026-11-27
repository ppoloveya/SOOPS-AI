import test from "node:test";
import assert from "node:assert/strict";
import { isValidToken, giftSentKey, sendGift, fetchGiftCount } from "./gift.ts";
import { shouldTrack, APP_EVENTS } from "./analytics.ts";

test("only 16-character lowercase hex tokens are accepted", () => {
  assert.equal(isValidToken("0123456789abcdef"), true);
  assert.equal(isValidToken("0123456789ABCDEF"), false);
  assert.equal(isValidToken("short"), false);
  assert.equal(isValidToken("0123456789abcdef; drop table"), false);
  assert.equal(isValidToken(undefined), false);
});

test("an invalid token never reaches the server", async () => {
  assert.equal(await sendGift("nope", "water"), false);
  assert.deepEqual(await fetchGiftCount("nope"), { water: 0, fertilizer: 0 });
});

test("the per-device gift key separates plant, kind and day", () => {
  const a = giftSentKey("0123456789abcdef", "water", "2026-11-28");
  assert.notEqual(a, giftSentKey("0123456789abcdef", "fertilizer", "2026-11-28"));
  assert.notEqual(a, giftSentKey("0123456789abcdef", "water", "2026-11-29"));
});

test("measurement respects Do Not Track and sends only the allowed event names", () => {
  assert.equal(shouldTrack({ doNotTrack: "1" }), false);
  assert.equal(shouldTrack({ doNotTrack: null }), true);
  assert.equal(APP_EVENTS.every(e => /^[a-z_]+$/.test(e)), true);
});
