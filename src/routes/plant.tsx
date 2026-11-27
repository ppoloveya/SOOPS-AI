import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { DeviceFrame } from "@/components/solvera/DeviceFrame";
import { BloomFlower } from "@/components/solvera/BloomFlower";
import { GROWTH_STAGES, MAX_GROWTH_XP } from "@/lib/solvera/growth";
import { parsePlantSnapshot } from "@/lib/solvera/plantShare";
import { GIFT_LABEL, giftSentKey, sendGift, type GiftKind } from "@/lib/solvera/gift";
import { trackEvent } from "@/lib/solvera/analytics";
import { todayISO } from "@/lib/solvera/storage";

export const Route = createFileRoute("/plant")({
  validateSearch: search => parsePlantSnapshot(search) ?? { name: "", day: -1, xp: 0 },
  component: Page,
  head: () => ({ meta: [
    { title: "친구의 찔레꽃 | SOOPSAI" },
    { name: "description", content: "SOOPSAI에서 자라는 친구의 찔레꽃을 만나보세요." },
    { property: "og:title", content: "친구의 찔레꽃 | SOOPSAI" },
    { property: "og:description", content: "SOOPSAI에서 자라는 친구의 찔레꽃을 만나보세요." },
  ] }),
});

function Page() {
  const search = Route.useSearch();
  const snapshot = search.day >= 0 ? search : null;
  const token = snapshot && "token" in snapshot ? snapshot.token : undefined;
  const [sent, setSent] = useState<Partial<Record<GiftKind, boolean>>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => { if (snapshot) trackEvent("share_link_open"); }, [snapshot?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!token) return;
    const today = todayISO();
    setSent({
      water: !!localStorage.getItem(giftSentKey(token, "water", today)),
      fertilizer: !!localStorage.getItem(giftSentKey(token, "fertilizer", today)),
    });
  }, [token]);

  const give = async (kind: GiftKind) => {
    if (!token || sent[kind]) return;
    const ok = await sendGift(token, kind);
    if (ok) {
      localStorage.setItem(giftSentKey(token, kind, todayISO()), "1");
      setSent(prev => ({ ...prev, [kind]: true }));
      setNotice(`${GIFT_LABEL[kind]}을(를) 보냈어요. 친구에게 응원으로 전해져요.`);
      trackEvent("gift_sent");
    } else {
      setNotice("지금은 보낼 수 없어요. 잠시 뒤 다시 시도해주세요.");
    }
  };
  return (
    <DeviceFrame>
      <main className="flex min-h-full flex-col px-5 pb-10 pt-9 text-center text-charcoal">
        <div className="font-serif text-[17px] font-bold tracking-brand text-plum">SOOPSAI</div>
        {snapshot ? <>
          <div className="mt-8 text-[11px] tracking-brand text-charcoal/55">A FRIEND'S GARDEN</div>
          <h1 className="mt-3 break-words font-serif text-[28px] leading-tight text-plum">{snapshot.name}</h1>
          <p className="mt-2 text-[13px] text-charcoal/65">{GROWTH_STAGES[snapshot.day]} · {snapshot.day}일차</p>
          <div className="flower-garden mt-7" aria-label={`${snapshot.name}의 성장 모습`}>
            <div className="flower-garden-light" aria-hidden="true" />
            <div className="flower-garden-plant"><BloomFlower day={snapshot.day} size={148} /></div>
            <div className="flower-garden-soil" aria-hidden="true" />
          </div>
          <div className="mx-auto mt-6 w-full max-w-[320px]">
            <div className="flex items-end justify-between"><span className="text-[12px] text-charcoal/65">성장 경험치</span><strong className="tnum text-[18px] text-forest">{snapshot.xp} / {MAX_GROWTH_XP} XP</strong></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/60" role="progressbar" aria-label="친구의 꽃 성장 경험치" aria-valuenow={snapshot.xp} aria-valuemin={0} aria-valuemax={MAX_GROWTH_XP}>
              <div className="h-full rounded-full bg-[#6d9f76]" style={{ width: `${snapshot.xp / MAX_GROWTH_XP * 100}%` }} />
            </div>
          </div>
          {token && (
            <div className="mx-auto mt-6 flex w-full max-w-[320px] gap-2">
              {(["water", "fertilizer"] as GiftKind[]).map(kind => (
                <button key={kind} type="button" onClick={() => give(kind)} disabled={!!sent[kind]}
                  className="flex-1 rounded-full border border-white/80 bg-white/50 px-3 py-2.5 text-[13px] font-semibold text-forest disabled:opacity-50">
                  {sent[kind] ? `오늘 ${GIFT_LABEL[kind]} 보냄` : `${GIFT_LABEL[kind]} 주기`}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 min-h-4 text-[11px] text-forest" role="status" aria-live="polite">{notice}</div>
          <p className="mt-5 text-[11px] text-charcoal/55">공유 당시의 모습 · 응원은 경험치에 더해지지 않아요</p>
        </> : <>
          <h1 className="mt-20 font-serif text-[25px] text-plum">식물 정보를 찾을 수 없어요</h1>
          <p className="mt-3 text-[13px] text-charcoal/65">공유 링크를 다시 확인해주세요.</p>
        </>}
        <a href="/" className="glass-lucky mt-auto inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-5 text-[13px] font-bold text-plum">
          나도 꽃 키우기 <ArrowRight size={16} aria-hidden="true" />
        </a>
      </main>
    </DeviceFrame>
  );
}
