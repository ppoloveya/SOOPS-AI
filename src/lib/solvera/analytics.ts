/**
 * 사용 흐름 측정. 보내는 것은 "사건 이름 + 기기별 임의 ID"뿐이며 피부·건강 기록, 메모, 식물 이름은 절대 포함하지 않는다.
 * 브라우저의 "추적 안 함(DNT)" 설정이 켜져 있으면 아무것도 보내지 않고, 서버가 없거나 실패해도 앱에는 영향이 없다.
 */
export const APP_EVENTS = [
  "app_open", "first_log", "challenge_complete", "next_cycle_start", "share_click", "share_link_open", "gift_sent",
  "quick_check", "quick_to_full", "chat_parse_confirmed", "chat_parse_corrected",
] as const;
export type AppEvent = typeof APP_EVENTS[number];

/** 기기당 한 번만 세는 이벤트(퍼널의 "몇 명이 도달했나"를 보기 위함). */
const ONCE_PER_DEVICE: ReadonlySet<AppEvent> = new Set(["first_log", "challenge_complete"]);

const ANON_KEY = "soopsai:anon-id";

export function shouldTrack(env: { doNotTrack?: string | null }): boolean {
  return env.doNotTrack !== "1";
}

function anonId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

interface EventsClient {
  from: (t: string) => { insert: (row: { anon_id: string; event: string }) => Promise<{ error: unknown }> };
}

export function trackEvent(event: AppEvent): void {
  if (typeof window === "undefined") return;
  try {
    if (!shouldTrack({ doNotTrack: navigator.doNotTrack })) return;
    if (ONCE_PER_DEVICE.has(event)) {
      const key = `soopsai:ev:${event}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    }
    const id = anonId();
    import("@/integrations/supabase/client")
      .then(({ supabase }) => (supabase as unknown as EventsClient).from("app_events").insert({ anon_id: id, event }))
      .catch(() => {});
  } catch {
    // 측정 실패는 사용자 경험에 영향을 주지 않는다.
  }
}
