import { useMemo } from "react";
import { analysisLogs } from "@/lib/solvera/analysis";
import { forecastFlare } from "@/lib/solvera/forecast";
import { cycleLength, nextPreWindow } from "@/lib/solvera/period";
import type { RecoverySession } from "@/lib/solvera/types";

/** 내일 트러블이 올라올 가능성. 과거 기록으로 검증해 기준 예측보다 낫다고 확인될 때만 숫자를 보여준다. */
export function ForecastCard({ session }: { session: RecoverySession }) {
  const result = useMemo(() => forecastFlare(analysisLogs(session), { periodStarts: session.periodStarts }), [session]);
  const pre = useMemo(() => nextPreWindow(session.periodStarts), [session.periodStarts]);
  const hasTrouble = session.selectedConcerns.includes("trouble");
  if (!hasTrouble) return null;

  return (
    <div className="glass-surface mt-6 rounded-2xl p-4 text-left" aria-label="내일 트러블 가능성">
      <div className="text-[11px] tracking-brand text-muted-foreground uppercase">내일 트러블 가능성 · 내 기록 기반</div>
      {result.status === "ok" ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tnum font-serif text-[28px] font-bold text-plum">약 {Math.round(result.probability * 100)}%</span>
            <span className="text-[12px] text-charcoal/65">평소 {Math.round(result.baseRate * 100)}%</span>
          </div>
          {result.drivers.length > 0 && (
            <p className="mt-1 text-[12px] leading-[1.6] text-charcoal/75">
              평소보다 높은 이유로 {result.drivers.map(d => d.label).join(", ")}이(가) 작용했어요.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground">
            지난 {result.testedDays}일을 하루씩 앞서 예측해 확인했을 때 평소 비율만 말하는 것보다 잘 맞았어요. 자가 기록에 기반한 가능성이며 진단이나 확정 예측이 아니에요.
          </p>
        </>
      ) : result.status === "insufficient" ? (
        <>
          <p className="mt-2 text-[13px] leading-[1.6] text-plum">아직 예측하기엔 기록이 부족해요.</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60" role="progressbar" aria-label="예측 준비 진행도" aria-valuenow={Math.min(result.haveDays, result.needDays)} aria-valuemin={0} aria-valuemax={result.needDays}>
            <div className="h-full rounded-full bg-[#6d9f76]" style={{ width: `${Math.min(100, (result.haveDays / result.needDays) * 100)}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground tnum">
            이어진 기록 {result.haveDays}/{result.needDays}일 · 트러블 점수가 올랐던 날과 평온했던 날이 각각 {result.needEvents}일 이상 필요해요. 매일 트러블 점수를 기록해주세요.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12px] leading-[1.6] text-charcoal/75">{result.reason}</p>
      )}
      {pre && (
        <p className="mt-3 border-t border-white/60 pt-3 text-[12px] leading-[1.6] text-charcoal/75 tnum">
          다음 생리 전 7일은 {pre.from.slice(5)} ~ {pre.to.slice(5)} 무렵으로 계산돼요 (내 주기 {cycleLength(session.periodStarts)}일 기준). 날짜 계산일 뿐, 트러블이 생긴다는 뜻은 아니에요.
        </p>
      )}
    </div>
  );
}
