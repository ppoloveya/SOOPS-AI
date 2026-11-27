import { cycleLength, normalizeStarts } from "@/lib/solvera/period";
import { todayISO } from "@/lib/solvera/storage";
import type { RecoverySession } from "@/lib/solvera/types";

/** 생리 시작일을 한 번 눌러 기록한다. 이 기기에만 저장되고 서버로 보내지 않는다. */
export function PeriodCard({ session, setSession }: { session: RecoverySession; setSession: (s: RecoverySession) => void }) {
  if (!session.showMenstrualFactor) return null;
  const starts = normalizeStarts(session.periodStarts);
  const today = todayISO();
  const startedToday = starts.includes(today);
  const last = starts[starts.length - 1];

  const add = () => setSession({ ...session, periodStarts: normalizeStarts([...starts, today]) });
  const undo = () => setSession({ ...session, periodStarts: starts.slice(0, -1) });

  return (
    <div className="glass-surface mt-6 rounded-2xl p-4 text-left" aria-label="생리 시작일 기록">
      <div className="text-[11px] tracking-brand text-muted-foreground uppercase">생리 주기 · 이 기기에만 저장</div>
      <p className="mt-2 text-[12px] leading-[1.6] text-charcoal/75">
        {last ? `마지막 시작일 ${last.slice(5)} · 내 주기 ${cycleLength(starts)}일${starts.length < 3 ? " (아직 기본값 포함)" : ""}` : "시작일을 기록하면 생리 전·중 구간과 트러블 패턴을 함께 비교해요."}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={add} disabled={startedToday}
          className="flex-1 rounded-full border border-white/80 bg-white/50 px-3 py-2.5 text-[13px] font-semibold text-plum disabled:opacity-50">
          {startedToday ? "오늘 시작으로 기록했어요" : "오늘 생리가 시작됐어요"}
        </button>
        {starts.length > 0 && (
          <button type="button" onClick={undo} className="rounded-full border border-white/80 px-3 py-2.5 text-[12px] text-charcoal/70">잘못 눌렀어요</button>
        )}
      </div>
    </div>
  );
}
