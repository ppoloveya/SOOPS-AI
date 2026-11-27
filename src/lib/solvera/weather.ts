import type { DailyLog, RecoverySession, WeatherDay } from "./types.ts";

/**
 * 날씨·자외선·습도·미세먼지를 "그날의 기록"에 붙인다.
 * 정확한 위치(GPS)는 쓰지 않는다. 사용자가 고른 시·도의 대표 도시 좌표만 날씨 서비스(Open-Meteo)에 보내고, 사용자 식별 정보는 보내지 않는다.
 */
export const REGIONS = {
  seoul: { label: "서울", lat: 37.57, lon: 126.98 },
  busan: { label: "부산", lat: 35.18, lon: 129.08 },
  daegu: { label: "대구", lat: 35.87, lon: 128.6 },
  incheon: { label: "인천", lat: 37.46, lon: 126.71 },
  gwangju: { label: "광주", lat: 35.16, lon: 126.85 },
  daejeon: { label: "대전", lat: 36.35, lon: 127.38 },
  ulsan: { label: "울산", lat: 35.54, lon: 129.31 },
  sejong: { label: "세종", lat: 36.48, lon: 127.29 },
  gyeonggi: { label: "경기", lat: 37.26, lon: 127.03 },
  gangwon: { label: "강원", lat: 37.88, lon: 127.73 },
  chungbuk: { label: "충북", lat: 36.64, lon: 127.49 },
  chungnam: { label: "충남", lat: 36.66, lon: 126.67 },
  jeonbuk: { label: "전북", lat: 35.82, lon: 127.15 },
  jeonnam: { label: "전남", lat: 34.81, lon: 126.46 },
  gyeongbuk: { label: "경북", lat: 36.57, lon: 128.73 },
  gyeongnam: { label: "경남", lat: 35.23, lon: 128.68 },
  jeju: { label: "제주", lat: 33.5, lon: 126.53 },
} as const;
export type RegionKey = keyof typeof REGIONS;
export const isRegionKey = (v: unknown): v is RegionKey => typeof v === "string" && v in REGIONS;

/** Open-Meteo가 과거 일수로 돌려주는 한도(안전하게 낮춰 잡음). 이보다 오래된 날은 붙이지 않는다. */
export const MAX_PAST_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

interface DailyBlock { time?: string[]; uv_index_max?: (number | null)[]; temperature_2m_mean?: (number | null)[]; relative_humidity_2m_mean?: (number | null)[] }
interface HourlyBlock { time?: string[]; pm2_5?: (number | null)[] }

/** 응답을 날짜별 값으로 바꾼다. 값이 빠진 날은 건너뛴다(잘못된 값을 만들지 않는다). */
export function parseWeather(daily: DailyBlock | undefined, hourly: HourlyBlock | undefined): Record<string, WeatherDay> {
  const out: Record<string, WeatherDay> = {};
  const pm: Record<string, number[]> = {};
  hourly?.time?.forEach((t, i) => {
    const v = hourly.pm2_5?.[i];
    if (typeof v === "number" && Number.isFinite(v)) (pm[t.slice(0, 10)] ??= []).push(v);
  });
  daily?.time?.forEach((date, i) => {
    const uv = daily.uv_index_max?.[i];
    const temp = daily.temperature_2m_mean?.[i];
    const humidity = daily.relative_humidity_2m_mean?.[i];
    if (typeof uv !== "number" || typeof temp !== "number" || typeof humidity !== "number") return;
    const p = pm[date];
    out[date] = { uv, temp, humidity, ...(p?.length ? { pm25: p.reduce((a, b) => a + b, 0) / p.length } : {}) };
  });
  return out;
}

export async function fetchDailyWeather(region: RegionKey, pastDays: number): Promise<Record<string, WeatherDay>> {
  const { lat, lon } = REGIONS[region];
  const past = Math.max(0, Math.min(MAX_PAST_DAYS, pastDays));
  const q = `latitude=${lat}&longitude=${lon}&past_days=${past}&forecast_days=1&timezone=Asia%2FSeoul`;
  try {
    const [weather, air] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${q}&daily=uv_index_max,temperature_2m_mean,relative_humidity_2m_mean`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&hourly=pm2_5`).catch(() => null),
    ]);
    if (!weather.ok) return {};
    const w = await weather.json();
    const a = air && air.ok ? await air.json() : null;
    return parseWeather(w.daily, a?.hourly);
  } catch {
    return {};
  }
}

/** 날씨가 아직 없는 기록에만 붙인다. 바뀐 게 없으면 같은 객체를 그대로 돌려줘서 불필요한 다시 그리기와 반복 호출을 막는다. */
export function attachWeatherToSession(session: RecoverySession, byDate: Record<string, WeatherDay>): RecoverySession {
  let changed = false;
  const attach = (logs: DailyLog[]) => logs.map(log => {
    if (log.weather || !byDate[log.date]) return log;
    changed = true;
    return { ...log, weather: byDate[log.date] };
  });
  const dailyLogs = attach(session.dailyLogs);
  const archivedLogs = session.archivedLogs ? attach(session.archivedLogs) : session.archivedLogs;
  return changed ? { ...session, dailyLogs, archivedLogs } : session;
}

/** 날씨가 비어 있는 가장 오래된 기록부터 오늘까지의 일수. 붙일 게 없거나 너무 오래됐으면 null. */
export function pastDaysNeeded(session: RecoverySession, today: string): number | null {
  const missing = [...(session.archivedLogs ?? []), ...session.dailyLogs].filter(l => !l.weather).map(l => l.date).sort();
  if (!missing.length) return null;
  const days = daysBetween(missing[0], today);
  return days < 0 ? null : Math.min(days, MAX_PAST_DAYS);
}
