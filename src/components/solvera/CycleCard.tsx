import { useMemo } from "react";
import { cumulativeSummary } from "@/lib/solvera/analysis";
import type { RecoverySession } from "@/lib/solvera/types";

/**
 * 한 주기(28일) 누적 리포트. 이전 주기를 합친 기록이 14일을 넘으면 첫 주와 최근 한 주를 나란히 보여주고 유형을 갱신한다.
 * 내 기록의 누적 요약일 뿐 효과를 판정하지 않는다.
 */
export function CycleCard({ session }: { session: RecoverySession }) {
  const summary = useMemo(() => cumulativeSummary(session), [session]);
  if (!summary) return null;
  const { days, milestone, firstWeekAvg, lastWeekAvg, type, top } = summary;
  const delta = firstWeekAvg - lastWeekAvg;
  const trend = Math.abs(delta) < 0.5 ? "비슷했어요" : delta > 0 ? `${delta.toFixed(1)}점 낮아졌어요` : `${(-delta).toFixed(1)}점 높아졌어요`;
  return (
    <div className="glass-surface mt-6 rounded-2xl p-4 text-left" aria-label="한 주기 리포트">
      <div className="text-[11px] tracking-brand text-muted-foreground uppercase">한 주기 리포트 · {days}일 기록</div>
      <p className="tnum mt-2 font-serif text-[16px] leading-[1.5] text-plum">첫 주 {firstWeekAvg.toFixed(1)}점 → 최근 7일 {lastWeekAvg.toFixed(1)}점</p>
      <p className="mt-1 text-[12px] leading-[1.5] text-charcoal/70">평균 불편 점수가 {trend}. 내 기록 기준이에요.</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="font-serif text-[16px] font-bold text-plum">{type.label}</span>
        {type.tentative && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-charcoal/70">잠정</span>}
      </div>
      {top && (
        <p className="tnum mt-1 text-[12px] leading-[1.5] text-charcoal/70">
          "{top.label}"이 있던 날 {top.withDays}일 · 없던 날 {top.withoutDays}일 비교 (이전 주기 포함)
        </p>
      )}
      <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground">
        {milestone === 28 ? "한 주기를 채웠어요. 같은 방식으로 다음 주기도 이어서 비교해요." : `${28 - days > 0 ? 28 - days : 0}일 더 기록하면 한 주기(28일) 기준으로 유형이 더 분명해져요.`}
      </p>
    </div>
  );
}
