/**
 * 매일 알림. 서버 없이 쓰려고 "고른 시간에 울리는 반복 일정(.ics)"을 사용자의 캘린더에 넣는 방식이다.
 * iOS·안드로이드 기본 캘린더가 알림을 띄우므로 푸시 서버·비밀 키·알림 권한이 필요 없다.
 * 웹 푸시(앱이 닫혀 있어도 오는 알림)는 서버가 필요해서 별도 단계에서 다룬다.
 */
export const REMINDER_DEFAULT_TIME = "21:00";
/** 한 주기(약 28일). 7일 기록은 학습에 짧다는 시뮬레이션 결과(docs/simulation.md)에 따라 한 주기로 잡는다. */
export const REMINDER_DAYS = 28;
const REMINDER_KEY = "soopsai:reminder:v1";

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export interface ReminderPref {
  time: string;
  savedAt: string;
}

export function loadReminder(storage: Pick<Storage, "getItem">): ReminderPref | null {
  try {
    const raw = storage.getItem(REMINDER_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ReminderPref>;
    return typeof v.time === "string" && isValidTime(v.time) ? { time: v.time, savedAt: typeof v.savedAt === "string" ? v.savedAt : "" } : null;
  } catch {
    return null;
  }
}

export function saveReminder(storage: Pick<Storage, "setItem">, pref: ReminderPref): void {
  storage.setItem(REMINDER_KEY, JSON.stringify(pref));
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 고른 시간이 오늘 이미 지났으면 내일부터, 아니면 오늘부터 시작한다. */
export function reminderStartDate(time: string, now: Date): string {
  const [h, m] = time.split(":").map(Number);
  const passed = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
  if (!passed) return localDate(now);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return localDate(next);
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/** RFC 5545: 한 줄은 75바이트를 넘지 않게 접는다(이어지는 줄은 공백으로 시작). 한글은 3바이트라 글자 단위로 센다. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = " ";
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n");
}

export interface ReminderIcsOptions {
  time: string;
  /** 시작 날짜(YYYY-MM-DD, 사용자의 현지 날짜) */
  startDate: string;
  days?: number;
  origin?: string;
  now?: Date;
}

/** 고른 시간에 매일 울리는 일정 파일. 시각은 "떠 있는 현지 시각"이라 사용자가 어느 시간대에 있든 그 시각에 울린다. */
export function buildReminderIcs(opts: ReminderIcsOptions): string {
  if (!isValidTime(opts.time)) throw new Error("invalid time");
  const days = opts.days ?? REMINDER_DAYS;
  const [h, m] = opts.time.split(":").map(Number);
  const day = opts.startDate.replace(/-/g, "");
  const endTotal = h * 60 + m + 10;
  const end = `${pad(Math.floor(endTotal / 60) % 24)}${pad(endTotal % 60)}00`;
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = "SOOPSAI 피부 10초 체크인";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SOOPSAI//Skin Check-in//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:soopsai-checkin-${day}-${pad(h)}${pad(m)}@soopsai`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${day}T${pad(h)}${pad(m)}00`,
    `DTEND:${day}T${end}`,
    `RRULE:FREQ=DAILY;COUNT=${days}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText("오늘 피부는 어때요? 10초면 돼요.")}`,
    ...(opts.origin ? [`URL:${opts.origin}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(title)}`,
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
