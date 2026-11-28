import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/solvera/analytics";
import { REMINDER_DAYS, REMINDER_DEFAULT_TIME, buildReminderIcs, isValidTime, loadReminder, reminderStartDate, saveReminder } from "@/lib/solvera/reminder";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * 매일 알림과 홈 화면 추가. 알림은 사용자의 캘린더에 "고른 시간에 울리는 일정"을 넣는 방식이라 이 앱이 알림 권한을 받거나 서버에 시간을 저장하지 않는다.
 * 고른 시간은 이 기기에만 저장한다.
 */
export function ReminderCard() {
  const [time, setTime] = useState(REMINDER_DEFAULT_TIME);
  const [status, setStatus] = useState("");
  const [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const saved = loadReminder(localStorage);
    if (saved) setTime(saved.time);
    setStandalone(isStandalone());
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const addToCalendar = () => {
    if (!isValidTime(time)) { setStatus("시간을 다시 골라주세요."); return; }
    const now = new Date();
    const ics = buildReminderIcs({ time, startDate: reminderStartDate(time, now), origin: window.location.origin, now });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "soopsai-checkin.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    saveReminder(localStorage, { time, savedAt: now.toISOString() });
    trackEvent("reminder_set");
    setStatus("일정 파일을 내려받았어요. 열어서 '추가'를 눌러주세요.");
  };

  const install = async () => {
    if (!installEvent) return;
    trackEvent("install_click");
    await installEvent.prompt();
    setInstallEvent(null);
  };

  return (
    <div className="glass-surface mt-6 rounded-2xl p-4 text-left" aria-label="매일 알림">
      <div className="text-[11px] tracking-brand text-muted-foreground uppercase">매일 알림 · {REMINDER_DAYS}일</div>
      <p className="mt-2 text-[12px] leading-[1.6] text-charcoal/75">고른 시간에 캘린더가 알려드려요. 하루 한 번, 10초면 돼요.</p>
      <div className="mt-3 flex items-center gap-2">
        <label htmlFor="reminder-time" className="sr-only">알림 시간</label>
        <input
          id="reminder-time"
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="tnum rounded-full border border-white/80 bg-white/50 px-4 py-2.5 text-[14px] text-plum"
        />
        <button type="button" onClick={addToCalendar}
          className="flex-1 rounded-full border border-white/80 bg-white/50 px-3 py-2.5 text-[13px] font-semibold text-plum">
          캘린더에 추가
        </button>
      </div>
      <p className="mt-2 min-h-[1.2em] text-[11px] leading-[1.5] text-charcoal/70" role="status" aria-live="polite">{status}</p>
      {!standalone && installEvent && (
        <button type="button" onClick={install} className="mt-1 rounded-full border border-white/80 px-4 py-2 text-[12px] font-semibold text-plum">홈 화면에 앱처럼 추가</button>
      )}
      {!standalone && !installEvent && ios && (
        <p className="mt-1 text-[11px] leading-[1.5] text-muted-foreground">아이폰은 하단의 공유 버튼에서 "홈 화면에 추가"를 누르면 앱처럼 열려요.</p>
      )}
    </div>
  );
}
