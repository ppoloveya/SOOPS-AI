import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REMINDER_DAYS, buildReminderIcs, foldLine, isValidTime, loadReminder, reminderStartDate, saveReminder } from "./reminder.ts";
import { APP_EVENTS } from "./analytics.ts";

const NOW = new Date(2026, 10, 28, 15, 0, 0); // 2026-11-28 15:00 현지

test("time must be HH:MM on a 24-hour clock", () => {
  for (const ok of ["00:00", "09:05", "21:00", "23:59"]) assert.equal(isValidTime(ok), true, ok);
  for (const bad of ["", "24:00", "9:05", "21:60", "21-00", "abc"]) assert.equal(isValidTime(bad), false, bad);
});

test("the reminder starts today if the time is still ahead, otherwise tomorrow", () => {
  assert.equal(reminderStartDate("21:00", NOW), "2026-11-28");
  assert.equal(reminderStartDate("09:00", NOW), "2026-11-29");
  assert.equal(reminderStartDate("15:00", NOW), "2026-11-29");
  assert.equal(reminderStartDate("08:00", new Date(2026, 11, 31, 23, 0)), "2027-01-01");
});

test("the calendar file repeats daily for one cycle with an alarm at the chosen time", () => {
  const ics = buildReminderIcs({ time: "21:30", startDate: "2026-11-28", origin: "https://soopsai.vercel.app", now: NOW });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /DTSTART:20261128T213000\r\n/);
  assert.match(ics, /DTEND:20261128T214000\r\n/);
  assert.match(ics, new RegExp(`RRULE:FREQ=DAILY;COUNT=${REMINDER_DAYS}\\r\\n`));
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY/);
  assert.match(ics, /TRIGGER:PT0S/);
  assert.match(ics, /URL:https:\/\/soopsai\.vercel\.app/);
  assert.ok(!ics.includes("DTSTART;TZID"), "floating local time keeps the alarm at the same wall-clock time");
  assert.doesNotMatch(ics, /[^\r]\n/, "every line break is CRLF");
});

test("the end time wraps past midnight and bad times are refused", () => {
  assert.match(buildReminderIcs({ time: "23:55", startDate: "2026-11-28", now: NOW }), /DTEND:20261128T000500\r\n/);
  assert.throws(() => buildReminderIcs({ time: "25:00", startDate: "2026-11-28", now: NOW }));
});

test("no line is longer than 75 bytes, and folded lines unfold to the original", () => {
  const long = "DESCRIPTION:" + "피부 체크인 알림입니다. ".repeat(12);
  const folded = foldLine(long);
  for (const line of folded.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(folded.replace(/\r\n /g, ""), long);
  const ics = buildReminderIcs({ time: "21:00", startDate: "2026-11-28", now: NOW });
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});

test("the chosen time is kept on this device and bad stored values are ignored", () => {
  const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(loadReminder(storage), null);
  saveReminder(storage, { time: "20:15", savedAt: "2026-11-28T06:00:00.000Z" });
  assert.deepEqual(loadReminder(storage), { time: "20:15", savedAt: "2026-11-28T06:00:00.000Z" });
  mem.set("soopsai:reminder:v1", JSON.stringify({ time: "99:99" }));
  assert.equal(loadReminder(storage), null);
  mem.set("soopsai:reminder:v1", "not json");
  assert.equal(loadReminder(storage), null);
});

test("every tracked event is allowed by the database constraint (otherwise inserts would fail silently)", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261128000100_events_and_gifts.sql", import.meta.url), "utf8");
  const block = sql.slice(sql.indexOf("event IN ("), sql.indexOf("))", sql.indexOf("event IN (")));
  const allowed = [...block.matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(allowed, [...APP_EVENTS].sort());
});
