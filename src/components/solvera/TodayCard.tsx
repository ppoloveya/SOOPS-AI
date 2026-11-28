import { useMemo } from "react";
import { lifestyleFactors, nextAction } from "@/lib/solvera/analysis";
import { experimentResult, experimentStatus, experimentTitle, markDone, startExperiment } from "@/lib/solvera/experiment";
import { trackEvent } from "@/lib/solvera/analytics";
import { todayISO } from "@/lib/solvera/storage";
import type { RecoverySession } from "@/lib/solvera/types";

const MIN_LOGS_FOR_SUGGESTION = 3;

const cardClass = "glass-surface mt-6 rounded-2xl p-4 text-left";
const labelClass = "text-[11px] tracking-brand text-muted-foreground uppercase";
const buttonClass = "rounded-full border border-white/80 bg-white/50 px-4 py-2.5 text-[13px] font-semibold text-plum disabled:opacity-50";

/**
 * 오늘의 한 가지 + 내 실험. 에이전트가 "이번 주는 이것 하나만"을 제안하고, 일주일 뒤 같은 방식으로 다시 비교한다.
 * 결과는 내 기록에서 보인 차이일 뿐 원인이나 제품 효과를 말하지 않는다. 실험 상태는 이 기기에만 저장한다.
 */
export function TodayCard({ session, setSession }: { session: RecoverySession; setSession: (s: RecoverySession) => void }) {
  const factors = useMemo(() => lifestyleFactors(session), [session]);
  const top = factors[0];
  const exp = session.experiment;
  const today = todayISO();

  if (exp) {
    const status = experimentStatus(exp, today);
    if (!status.ended) {
      return (
        <div className={cardClass} aria-label="내 실험">
          <div className={labelClass}>내 실험 · {status.dayNumber}/{exp.days}일차</div>
          <p className="mt-2 font-serif text-[16px] leading-[1.5] text-plum">{experimentTitle(exp)}</p>
          <div className="mt-3 flex gap-1.5" aria-label={`해봤어요 ${status.doneCount}일`}>
            {Array.from({ length: exp.days }, (_, i) => {
              const date = new Date(Date.parse(`${exp.startDate}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
              return <span key={date} className={`h-2.5 w-2.5 rounded-full ${exp.doneDates.includes(date) ? "bg-moss" : "bg-white/70 border border-border"}`} />;
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={status.doneToday} className={`${buttonClass} flex-1`}
              onClick={() => { setSession({ ...session, experiment: markDone(exp, today) }); trackEvent("experiment_done"); }}>
              {status.doneToday ? "오늘 해봤어요 ✓" : "오늘 해봤어요"}
            </button>
            <button type="button" className="rounded-full border border-white/80 px-3 py-2.5 text-[12px] text-charcoal/70"
              onClick={() => setSession({ ...session, experiment: undefined })}>그만두기</button>
          </div>
          <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground">피부 점수는 지금처럼 매일 기록해주세요. 일주일 뒤 같은 방식으로 다시 비교해요.</p>
        </div>
      );
    }
    const result = experimentResult(session, exp);
    return (
      <div className={cardClass} aria-label="내 실험 결과">
        <div className={labelClass}>내 실험 결과</div>
        <p className="mt-2 font-serif text-[16px] leading-[1.5] text-plum">{experimentTitle(exp)}</p>
        <p className="tnum mt-1 text-[12px] text-charcoal/65">해봤어요 {result.doneCount}/{exp.days}일</p>
        <p className="mt-2 text-[13px] leading-[1.6] text-charcoal/80">{result.text}</p>
        <div className="mt-3 flex gap-2">
          {top && (
            <button type="button" className={`${buttonClass} flex-1`}
              onClick={() => { setSession({ ...session, experiment: startExperiment(top, today) }); trackEvent("experiment_start"); }}>
              새 실험 시작
            </button>
          )}
          <button type="button" className="rounded-full border border-white/80 px-3 py-2.5 text-[12px] text-charcoal/70"
            onClick={() => setSession({ ...session, experiment: undefined })}>닫기</button>
        </div>
        <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground">내 기록에서 그렇게 보였다는 뜻이며 원인이나 제품 효과를 판정한 결과는 아니에요.</p>
      </div>
    );
  }

  if (!top || session.dailyLogs.length < MIN_LOGS_FOR_SUGGESTION) return null;
  const action = nextAction(factors);
  return (
    <div className={cardClass} aria-label="오늘의 한 가지">
      <div className={labelClass}>오늘의 한 가지{top.clear ? "" : " · 잠정"}</div>
      <p className="mt-2 font-serif text-[16px] leading-[1.5] text-plum">{action.title}</p>
      <p className="tnum mt-1 text-[12px] leading-[1.5] text-charcoal/65">
        "{top.label}"이 있던 날 {top.withDays}일 · 없던 날 {top.withoutDays}일을 비교했어요.
      </p>
      <button type="button" className={`${buttonClass} mt-3`}
        onClick={() => { setSession({ ...session, experiment: startExperiment(top, today) }); trackEvent("experiment_start"); }}>
        이번 주 실험으로 해볼게요
      </button>
    </div>
  );
}
