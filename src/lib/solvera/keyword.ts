/**
 * 감성 요약 유틸 — "오늘 하루 한마디" 자유 입력에서 공감 멘트 + 키워드 1개를 뽑는다.
 * 규칙 기반이며, 정형 태그 데이터(수면/운동/생활습관/피부 점수)에는 절대 반영하지 않는다.
 */

export type EmpathyCategory = "stress" | "calm" | "dryness" | "default";

const BANK: Record<EmpathyCategory, { keywords: string[]; lines: string[]; label: string }> = {
  stress: {
    label: "스트레스",
    keywords: ["스트레스", "예민", "힘들", "지침", "지쳤", "지쳐", "짜증", "바빴", "바쁘", "피곤", "피로", "불안", "압박", "야근"],
    lines: [
      "오늘 많이 애쓰셨네요. 잠깐이라도 숨 돌리는 시간 가지시길 바라요 🌿",
      "마음이 분주한 하루였군요. 그래도 오늘 기록까지 남겨주셔서 고마워요.",
      "고단한 하루였겠어요. 오늘 밤은 조금 더 일찍 쉬어보는 것도 좋겠어요.",
    ],
  },
  dryness: {
    label: "피부 컨디션",
    keywords: ["건조", "당김", "따가", "붉은기", "붉어", "트러블", "여드름", "뒤집", "가려", "각질", "열감"],
    lines: [
      "피부가 좀 예민했겠어요. 오늘은 진정 케어에 조금 더 신경 써보세요.",
      "건조함이 느껴지는 날엔 보습을 한 겹 더해주는 게 도움이 돼요.",
      "피부가 힘든 하루였네요. 무리한 자극은 잠시 피해주세요.",
    ],
  },
  calm: {
    label: "안정감",
    keywords: ["편안", "좋았", "행복", "즐거", "안정", "기분좋", "기분 좋", "웃", "설레", "여유", "개운", "상쾌"],
    lines: [
      "오늘 같은 날이 많아지면 좋겠어요 🌸",
      "편안한 하루를 보내셨다니 저도 기분이 좋아지네요.",
      "기분 좋은 하루였다니 다행이에요. 이 여운이 오래가길요.",
    ],
  },
  default: {
    label: "오늘의 기록",
    keywords: [],
    lines: [
      "기록해주셔서 고마워요. 오늘 하루도 잘 마무리하세요 🌙",
      "작은 기록이지만 차곡차곡 쌓이고 있어요. 내일도 함께해요.",
    ],
  },
};

export function detectCategory(text: string): EmpathyCategory {
  const t = text.trim();
  for (const key of ["stress", "dryness", "calm"] as const) {
    if (BANK[key].keywords.some(k => t.includes(k))) return key;
  }
  return "default";
}

export function keywordFor(text: string): string {
  return BANK[detectCategory(text)].label;
}

export function empathyLine(text: string): string {
  const lines = BANK[detectCategory(text)].lines;
  return lines[Math.floor(Math.random() * lines.length)];
}

export function analyzeNote(text: string): { keyword: string; empathy: string; category: EmpathyCategory } {
  const category = detectCategory(text);
  const bank = BANK[category];
  return {
    category,
    keyword: bank.label,
    empathy: bank.lines[Math.floor(Math.random() * bank.lines.length)],
  };
}

/** 가장 자주 등장한 키워드 */
export function topKeyword(keywords: string[]): string | null {
  if (!keywords.length) return null;
  const count = new Map<string, number>();
  keywords.forEach(k => count.set(k, (count.get(k) ?? 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
