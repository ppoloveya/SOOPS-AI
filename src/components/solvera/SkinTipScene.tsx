import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { CONCERN_LABEL, type ConcernKey } from "@/lib/solvera/types";

type Tip = { label: string; title: string; body: string; action: string; source: string };

const GENERAL_TIP: Tip = {
  label: "자외선 차단",
  title: "얼굴엔 얼마나 발라야 할까?",
  body: "성인 얼굴엔 자외선 차단제 최소 약 1티스푼, 검지와 중지 길이만큼이 기준이에요. 야외에 오래 있다면 2시간마다 다시 발라주세요.",
  action: "바로 해보기 · 얼굴에 바르는 양 확인하기",
  source: "https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen",
};

const CONCERN_TIPS: Record<ConcernKey, Tip> = {
  redness: {
    label: CONCERN_LABEL.redness,
    title: "'무향'과 '향료 무첨가'는 달라요",
    body: "향을 가린 '무향(unscented)' 제품에도 향 관련 성분이 있을 수 있어요. 자극에 민감하다면 '향료 무첨가(fragrance-free)' 표시를 확인해보세요.",
    action: "바로 해보기 · 제품 라벨의 향료 표시 확인",
    source: "https://www.aad.org/public/diseases/rosacea/triggers/tips",
  },
  heat: {
    label: CONCERN_LABEL.heat,
    title: "목에 시원한 천 한 장",
    body: "더운 곳에서 열감이 올라온다면 시원한 곳으로 옮겨 목에 차갑게 적신 천을 대보세요. 뜨거운 샤워가 계기였는지도 기록해두면 좋아요.",
    action: "바로 해보기 · 열감이 오른 상황 한 가지 기록",
    source: "https://www.aad.org/public/diseases/rosacea/triggers/prevent/",
  },
  dryness: {
    label: CONCERN_LABEL.dryness,
    title: "당김엔 로션보다 크림",
    body: "건조함이 심한 날엔 가벼운 로션보다 크림이 수분을 더 오래 붙잡아줄 수 있어요. 씻은 뒤 물기가 남아 있을 때 바르는 것도 도움이 돼요.",
    action: "바로 해보기 · 보습제 제형과 바르는 때 점검",
    source: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin",
  },
  trouble: {
    label: CONCERN_LABEL.trouble,
    title: "제품을 자주 갈아타지 않기",
    body: "트러블 관리 제품은 며칠 만에 판단하기 어려워요. 매주 바꾸기보다 보통 6~8주 경과를 살펴보되, 자극이 생기면 사용을 멈추고 상담하세요.",
    action: "바로 해보기 · 새로 쓴 제품의 시작일 기록",
    source: "https://www.aad.org/public/diseases/acne/skin-care/habits-stop",
  },
  shine: {
    label: CONCERN_LABEL.shine,
    title: "기름종이는 '쓱'보다 '꾹'",
    body: "번들거리는 곳에 기름종이를 몇 초간 가볍게 눌러보세요. 문지르지 않으면 유분을 다른 부위로 퍼뜨리지 않고 흡수할 수 있어요.",
    action: "바로 해보기 · 문지르지 않고 잠깐 누르기",
    source: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/oily-skin",
  },
  pores: {
    label: CONCERN_LABEL.pores,
    title: "모공은 짜면 더 도드라질 수 있어요",
    body: "손으로 모공을 짜거나 파면 피부가 자극돼 더 눈에 띌 수 있어요. 제품을 살 땐 'non-comedogenic' 표시를 확인해보세요.",
    action: "바로 해보기 · 모공을 손으로 짜지 않기",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/face/treat-large-pores",
  },
  texture: {
    label: CONCERN_LABEL.texture,
    title: "각질 제거 전, 쓰는 제품부터 확인",
    body: "레티놀이나 벤조일퍼옥사이드 제품을 쓰고 있다면 각질 제거를 더할 때 건조함과 자극이 심해질 수 있어요. 오늘 루틴을 먼저 살펴보세요.",
    action: "바로 해보기 · 각질 제거제 겹쳐 쓰는지 확인",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/safely-exfoliate-at-home",
  },
  makeup: {
    label: CONCERN_LABEL.makeup,
    title: "얼굴 전체를 똑같이 바르지 않아도 돼요",
    body: "볼은 건조하고 이마·코는 번들거린다면 부위별로 보습량을 달리해보세요. 건조한 곳에 더하고 유분이 많은 곳은 가볍게 조절할 수 있어요.",
    action: "바로 해보기 · 들뜨는 부위와 유분 많은 부위 구분",
    source: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer",
  },
};

export function SkinTipScene({ concerns }: { concerns: ConcernKey[] }) {
  const [index, setIndex] = useState(0);
  const tips = [GENERAL_TIP, ...concerns.map(concern => CONCERN_TIPS[concern])];
  const current = Math.min(index, tips.length - 1);
  const tip = tips[current];

  return (
    <section className="skin-tip-scene -mx-5 mt-9 px-6 py-7" aria-label="피부 고민별 관리 팁">
      <div className="skin-tip-scene-top">
        <span>SKIN FIELD GUIDE</span>
        <span className="tnum">{String(current + 1).padStart(2, "0")} / {String(tips.length).padStart(2, "0")}</span>
      </div>
      <div className="skin-tip-scene-content" key={current} aria-live="polite">
        <div className="skin-tip-scene-label">{tip.label}</div>
        <h3 className="font-serif">{tip.title}</h3>
        <p>{tip.body}</p>
        <div className="skin-tip-scene-action">{tip.action}</div>
      </div>
      <div className="skin-tip-scene-bottom">
        <a href={tip.source} target="_blank" rel="noopener noreferrer" className="skin-tip-scene-source">AAD 원문 <ExternalLink size={13} aria-hidden="true" /></a>
        <div className="skin-tip-scene-nav">
          <button type="button" onClick={() => setIndex(Math.max(0, current - 1))} disabled={current === 0} aria-label="이전 피부 팁" title="이전 피부 팁"><ArrowLeft size={18} /></button>
          <button type="button" onClick={() => setIndex(Math.min(tips.length - 1, current + 1))} disabled={current === tips.length - 1} aria-label="다음 피부 팁" title="다음 피부 팁"><ArrowRight size={18} /></button>
        </div>
      </div>
      <div className="skin-tip-scene-progress" aria-hidden="true">{tips.map((_, step) => <span key={step} className={step === current ? "active" : ""} />)}</div>
    </section>
  );
}
