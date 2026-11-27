import { useEffect, useRef, useState } from "react";
import { BloomFlower } from "./BloomFlower";
import {
  EMOTION_SCORE, EXERCISE_META, CONTEXT_KEYS, EXERCISE_KEYS,
  type LogField, type FieldSource,
  type ConcernKey, type ContextKey, type DailyLog, type EmotionKey, type ExerciseKey,
  type RecoverySession, type SleepCategory,
} from "@/lib/solvera/types";
import { todayISO } from "@/lib/solvera/storage";
import { currentStreak, hasCompletedChallenge } from "@/lib/solvera/streak";
import { analyzeNote } from "@/lib/solvera/keyword";
import { trackEvent } from "@/lib/solvera/analytics";
import { sleepCategoryFrom } from "@/lib/solvera/analysis";

type Msg = { id: number; role: "bot" | "user"; text: string; subtle?: boolean };
type Option = { value: string; label: string; reply: string; score: number };
type LifeDraft = {
  emotions: EmotionKey[];
  exercise: ExerciseKey;
  context: ContextKey[];
  sleep: SleepCategory;
  /** 문장에서 "6시간 잤어"처럼 정확한 시간을 읽은 경우의 분 */
  sleepMinutes?: number;
  ampoule: boolean;
  /** 문장에서 실제로 읽어낸 항목 — false면 말하지 않은 것이라 기본값이 들어간 상태 */
  found: Record<LogField, boolean>;
};

const concernLabel: Record<ConcernKey, string> = {
  redness: "붉은기",
  heat: "열감",
  dryness: "건조함",
  trouble: "트러블",
  shine: "번들거림",
  pores: "모공",
  texture: "피부결",
  makeup: "메이크업 들뜸",
};

const emotionLabel: Record<EmotionKey, string> = {
  calm: "편안함",
  fresh: "산뜻함",
  energetic: "기운 있음",
  satisfied: "만족",
  serene: "차분함",
  normal: "평소 같음",
  tired: "피곤함",
  listless: "무기력",
  sensitive: "예민함",
  unfocused: "집중 어려움",
  stressed: "스트레스",
  anxious: "불안함",
  stuffy: "답답함",
  irritated: "짜증",
  pressured: "압박감",
};

const exerciseLabel: Record<ExerciseKey, string> = {
  gym: "헬스",
  running: "러닝",
  walking: "산책",
  yoga: "요가",
  pilates: "필라테스",
  cycling: "자전거",
  swimming: "수영",
  hiking: "등산",
  ballsports: "구기 운동",
  none: "운동 없음",
};

const contextLabel: Record<ContextKey, string> = {
  longtravel: "오래 이동",
  trip: "여행",
  outdoor: "야외 활동",
  alcohol: "음주",
  menstrual: "생리 전후",
  skippedcleanse: "세안을 깜빡함",
  mask: "마스크 오래 착용",
  newcosmetic: "새 화장품",
  latecleanse: "늦은 클렌징",
  none: "특별한 요인 없음",
};

const sleepMeta: Record<SleepCategory, { label: string; bedtime: string; wakeTime: string; minutes: number }> = {
  overSeven: { label: "푹 잠", bedtime: "23:00", wakeTime: "07:00", minutes: 480 },
  sixToSeven: { label: "보통 수면", bedtime: "23:40", wakeTime: "06:20", minutes: 400 },
  fiveToSix: { label: "조금 부족한 수면", bedtime: "00:30", wakeTime: "06:00", minutes: 330 },
  under5: { label: "수면 부족", bedtime: "01:30", wakeTime: "05:30", minutes: 240 },
};

const bloomSub: Record<number, string> = {
  1: "오늘의 첫 새싹을 기록해요",
  2: "조금씩 리듬을 찾는 중이에요",
  3: "작은 변화도 같이 남겨볼게요",
  4: "중간 지점까지 잘 왔어요",
  5: "컨디션의 패턴이 보이기 시작해요",
  6: "거의 다 왔어요. 오늘도 가볍게",
  7: "마지막 기록까지 차분히 마무리해요",
};

const normalize = (text: string) => text.toLowerCase().replace(/\s/g, "").replace(/[.,!?~]/g, "");
const includesAny = (text: string, words: string[]) => words.some(word => text.includes(normalize(word)));
/** includesAny와 같지만 바로 뒤에 부정("안", "없", "못")이 붙은 말은 제외한다. */
const hasWord = (text: string, words: string[]) => words.some(word => {
  const w = normalize(word);
  return text.includes(w) && !new RegExp(`${w}(?:는|은|이|가|도|을|를)?(?:안|없|못|별로안|전혀)`).test(text);
});

const concernOptions: Record<ConcernKey, Option[]> = {
  trouble: [
    { value: "calmed", label: "가라앉는 중", reply: "트러블이 가라앉는 중", score: 3 },
    { value: "same", label: "그대로 유지", reply: "큰 변화 없이 유지", score: 6 },
    { value: "new_one", label: "한두 개 새로 남", reply: "한두 개 새로 남", score: 7 },
    { value: "new_many", label: "여러 개 새로 남", reply: "여러 개 새로 남", score: 9 },
    { value: "angry", label: "붓고 아픔", reply: "붓고 아픈 느낌", score: 10 },
  ],
  redness: [
    { value: "clear", label: "거의 없음", reply: "붉은기가 거의 없음", score: 2 },
    { value: "less", label: "옅어짐", reply: "붉은기가 옅어짐", score: 4 },
    { value: "same", label: "비슷함", reply: "비슷하게 남아 있음", score: 6 },
    { value: "patchy", label: "군데군데 있음", reply: "군데군데 붉음", score: 8 },
    { value: "strong", label: "전체적으로 붉음", reply: "전체적으로 붉음", score: 10 },
  ],
  heat: [
    { value: "none", label: "거의 없음", reply: "열감 거의 없음", score: 2 },
    { value: "brief", label: "잠깐 올라옴", reply: "잠깐 올라옴", score: 4 },
    { value: "evening", label: "저녁에 느껴짐", reply: "저녁에 느껴짐", score: 6 },
    { value: "often", label: "자주 화끈", reply: "자주 화끈거림", score: 8 },
    { value: "lasting", label: "오래 지속", reply: "오래 지속됨", score: 10 },
  ],
  dryness: [
    { value: "comfortable", label: "편안함", reply: "건조함 없이 편안함", score: 2 },
    { value: "after_wash", label: "세안 후 당김", reply: "세안 후에만 당김", score: 4 },
    { value: "afternoon", label: "오후부터 당김", reply: "오후부터 당김", score: 6 },
    { value: "all_day", label: "종일 당김", reply: "종일 당김", score: 8 },
    { value: "flaky", label: "각질/따가움", reply: "각질이나 따가움 있음", score: 10 },
  ],
  shine: [
    { value: "balanced", label: "균형 있음", reply: "유분감 균형 있음", score: 2 },
    { value: "tzone", label: "T존만 살짝", reply: "T존만 살짝 번들거림", score: 4 },
    { value: "afternoon", label: "오후부터 번들", reply: "오후부터 번들거림", score: 6 },
    { value: "makeup", label: "화장이 무너짐", reply: "화장이 무너짐", score: 8 },
    { value: "heavy", label: "종일 번들", reply: "종일 번들거림", score: 10 },
  ],
  pores: [
    { value: "fine", label: "신경 안 쓰임", reply: "모공이 신경 안 쓰임", score: 2 },
    { value: "slight", label: "조금 보임", reply: "조금 보임", score: 4 },
    { value: "same", label: "평소와 같음", reply: "평소와 같음", score: 6 },
    { value: "visible", label: "눈에 띔", reply: "눈에 띔", score: 8 },
    { value: "rough", label: "요철처럼 느껴짐", reply: "요철처럼 느껴짐", score: 10 },
  ],
  texture: [
    { value: "smooth", label: "매끈함", reply: "매끈함", score: 2 },
    { value: "slight", label: "살짝 거침", reply: "살짝 거침", score: 4 },
    { value: "same", label: "평소와 같음", reply: "평소와 같음", score: 6 },
    { value: "rough", label: "거칠게 느껴짐", reply: "거칠게 느껴짐", score: 8 },
    { value: "bumpy", label: "오돌토돌함", reply: "오돌토돌함", score: 10 },
  ],
  makeup: [
    { value: "none", label: "잘 먹음", reply: "메이크업이 잘 먹음", score: 2 },
    { value: "small", label: "부분적으로만", reply: "부분적으로만 들뜸", score: 4 },
    { value: "same", label: "평소 정도", reply: "평소 정도", score: 6 },
    { value: "visible", label: "눈에 띄게 들뜸", reply: "눈에 띄게 들뜸", score: 8 },
    { value: "hard", label: "바르기 어려움", reply: "바르기 어려움", score: 10 },
  ],
};

const optionAliases: Record<string, string[]> = {
  calmed: ["가라앉", "진정", "줄었", "나아졌"],
  same: ["그대로", "비슷", "유지", "평소"],
  new_one: ["한두", "하나", "두개", "조금새로"],
  new_many: ["여러", "많이새로", "많이올라"],
  angry: ["붓", "아프", "통증", "화난"],
  clear: ["거의없", "깨끗", "없어"],
  less: ["옅", "줄었", "나아"],
  patchy: ["군데군데", "부분"],
  strong: ["전체", "많이붉", "심해"],
  brief: ["잠깐", "금방"],
  evening: ["저녁", "밤"],
  often: ["자주", "계속올라"],
  lasting: ["오래", "계속"],
  comfortable: ["편안", "괜찮"],
  after_wash: ["세안", "씻고"],
  afternoon: ["오후"],
  all_day: ["종일", "하루종일"],
  flaky: ["각질", "따가", "따끔"],
  balanced: ["균형", "괜찮"],
  tzone: ["티존", "t존"],
  makeup: ["화장", "메이크업", "무너"],
  heavy: ["종일", "많이"],
  fine: ["신경안", "괜찮"],
  slight: ["조금", "살짝"],
  visible: ["눈에띄", "잘보"],
  rough: ["요철", "거칠"],
  smooth: ["매끈", "부드"],
  bumpy: ["오돌", "울퉁"],
  small: ["부분", "살짝"],
  hard: ["어려", "안먹", "힘들"],
};

function parseLife(text: string, showMenstrual: boolean): LifeDraft {
  const t = normalize(text);
  const emotions: EmotionKey[] = [];
  const addEmotion = (key: EmotionKey, words: string[]) => {
    if (hasWord(t, words) && emotions.length < 2) emotions.push(key);
  };
  addEmotion("tired", ["피곤", "졸려", "지침", "힘들"]);
  addEmotion("stressed", ["스트레스", "빡세", "바빴", "압박"]);
  addEmotion("sensitive", ["예민", "민감"]);
  addEmotion("anxious", ["불안", "걱정"]);
  addEmotion("calm", ["편안", "안정", "괜찮", "괜찮음"]);
  addEmotion("fresh", ["산뜻", "상쾌"]);
  addEmotion("normal", ["평소", "보통"]);

  let exercise: ExerciseKey = "none";
  if (includesAny(t, ["산책", "걸었", "걷기"])) exercise = "walking";
  else if (includesAny(t, ["러닝", "달리", "뛰었"])) exercise = "running";
  else if (includesAny(t, ["헬스", "근력"])) exercise = "gym";
  else if (includesAny(t, ["요가"])) exercise = "yoga";
  else if (includesAny(t, ["필라테스"])) exercise = "pilates";
  else if (includesAny(t, ["자전거"])) exercise = "cycling";
  else if (includesAny(t, ["수영"])) exercise = "swimming";
  else if (includesAny(t, ["등산"])) exercise = "hiking";
  else if (includesAny(t, ["축구", "농구", "테니스", "구기"])) exercise = "ballsports";

  const context: ContextKey[] = [];
  const addContext = (key: ContextKey, words: string[]) => {
    if (hasWord(t, words)) context.push(key);
  };
  addContext("longtravel", ["오래이동", "장거리", "이동많"]);
  addContext("trip", ["여행"]);
  addContext("outdoor", ["야외", "밖에", "외출", "햇빛"]);
  addContext("alcohol", ["술", "음주", "맥주", "와인"]);
  if (showMenstrual) addContext("menstrual", ["생리"]);
  addContext("mask", ["마스크"]);
  addContext("newcosmetic", ["새화장품", "처음쓴", "새로쓴"]);
  addContext("latecleanse", ["늦게씻", "클렌징늦", "늦은클렌징"]);
  // "세안을 깜빡했어요", "세수 안 했어", "클렌징을 못 했어"처럼 조사가 끼어도 읽는다
  if (/(세안|세수|클렌징)(을|를|은|는|도)?(깜빡|까먹|안했|안하고|못했|건너|생략)/.test(t) || includesAny(t, ["안씻고잤", "안씻고"])) context.push("skippedcleanse");

  let sleep: SleepCategory = "sixToSeven";
  let sleepFound = false;
  let sleepMinutes: number | undefined;
  const hours = t.match(/(\d{1,2}(?:\.\d)?)시간/);
  if (hours && includesAny(t, ["잠", "잤", "수면"]) && Number(hours[1]) > 0 && Number(hours[1]) <= 16) {
    sleepMinutes = Math.round(Number(hours[1]) * 60);
    sleep = sleepCategoryFrom(sleepMinutes);
    sleepFound = true;
  } else if (includesAny(t, ["푹", "푹잠", "잘잤", "많이잤"])) { sleep = "overSeven"; sleepFound = true; }
  else if (includesAny(t, ["거의못", "못잤", "잠못"])) { sleep = "under5"; sleepFound = true; }
  else if (includesAny(t, ["부족", "조금잤", "설쳤"])) { sleep = "fiveToSix"; sleepFound = true; }

  const ampoule = includesAny(t, ["숲사이", "앰플"]) && !includesAny(t, ["안썼", "못썼", "안발랐", "미사용", "사용안했", "사용하지않", "안썼어요"]);

  const exerciseFound = exercise !== "none" || includesAny(t, ["운동안", "운동못", "쉬었어", "쉬었다", "움직이지않"]);
  const contextFound = context.length > 0 || includesAny(t, ["특별없", "별일없", "평소같", "평소처럼"]);
  return {
    emotions: emotions.length ? emotions : ["normal"],
    exercise,
    context: context.length ? [...new Set(context)] : ["none"],
    sleep,
    sleepMinutes,
    ampoule,
    found: {
      sleep: sleepFound,
      emotions: emotions.length > 0,
      exercise: exerciseFound,
      context: contextFound,
      ampoule: includesAny(t, ["숲사이", "앰플"]),
    },
  };
}

function matchConcernOption(concern: ConcernKey, text: string) {
  const t = normalize(text);
  return concernOptions[concern].find(option => {
    const terms = [option.label, option.reply, option.value, ...(optionAliases[option.value] ?? [])].map(normalize);
    return terms.some(term => term && (t.includes(term) || term.includes(t)));
  });
}

export function ChatDailyFlow({ session, setSession, onDone, onCancel }: {
  session: RecoverySession;
  setSession: (s: RecoverySession) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const day = Math.min(currentStreak(session.dailyLogs, todayISO()) + 1, 7);
  const [phase, setPhase] = useState<"life" | "confirm" | "concern" | "note" | "saving" | "done">("life");
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 1, role: "bot", text: `오늘의 작은 변화를 같이 남겨볼게요.` },
    {
      id: 2,
      role: "bot",
      text: "오늘 몸과 마음이 어땠는지 편하게 들려주세요. 기분, 움직임, 잠, 숲사이 앰플 사용 여부까지 한 번에 말해도 제가 조용히 정리해둘게요.",
      subtle: true,
    },
  ]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [life, setLife] = useState<LifeDraft | null>(null);
  const [confirmDraft, setConfirmDraft] = useState<LifeDraft | null>(null);
  const [touched, setTouched] = useState<LogField[]>([]);
  const [lifeSources, setLifeSources] = useState<Partial<Record<LogField, FieldSource>>>({});
  const [concernIndex, setConcernIndex] = useState(0);
  const [concernScores, setConcernScores] = useState<Partial<Record<ConcernKey, number>>>({});
  const idRef = useRef(2);
  const recRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentConcern = session.selectedConcerns[concernIndex];
  const push = (role: Msg["role"], text: string, subtle?: boolean) =>
    setMsgs(m => [...m, { id: ++idRef.current, role, text, subtle }]);

  const lifeGroups = [
    { title: "기분", items: ["피곤", "괜찮음", "스트레스", "예민"] },
    { title: "운동", items: ["산책", "러닝", "헬스", "안 함"] },
    { title: "활동", items: ["마스크", "야외", "음주", "특별 없음"] },
    { title: "수면", items: ["부족", "푹 잠", "거의 못 잠"] },
    { title: "앰플", items: ["숲사이 사용", "숲사이 미사용"] },
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, phase]);

  const askConcern = (index: number) => {
    const key = session.selectedConcerns[index];
    if (!key) {
      setPhase("note");
      push("bot", "좋아요. 이제 거의 끝났어요. 오늘을 한 문장으로만 남겨줘도 충분해요.");
      return;
    }
    setPhase("concern");
    push("bot", `${concernLabel[key]}은 오늘 어떤 변화였어요? 편하게 말해도 되고, 아래에서 가까운 표현을 골라도 돼요.`);
  };

  const submitLife = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    push("user", value);
    setText("");
    const parsed = parseLife(value, session.showMenstrualFactor);
    setLife(parsed);
    setConfirmDraft(parsed);
    setTouched([]);
    const missing = (Object.keys(parsed.found) as LogField[]).filter(f => !parsed.found[f]).length;
    push(
      "bot",
      missing === 5
        ? "문장에서 읽어낸 항목이 없었어요. 아래에서 해당하는 것만 눌러주세요. 안 누른 항목은 분석에 쓰지 않고 비워둘게요."
        : "이렇게 이해했어요. 틀린 곳만 눌러서 바꿔주세요. 말씀 안 하신 항목은 안 눌러도 돼요. 그 항목은 분석에 쓰지 않고 비워둘게요.",
      true,
    );
    setPhase("confirm");
  };

  const changeDraft = (field: LogField, patch: Partial<LifeDraft>) => {
    setConfirmDraft(d => (d ? { ...d, ...patch } : d));
    setTouched(t => (t.includes(field) ? t : [...t, field]));
  };

  const confirmLife = () => {
    if (!confirmDraft || !life) return;
    const fields = Object.keys(life.found) as LogField[];
    const sources: Partial<Record<LogField, FieldSource>> = {};
    for (const f of fields) sources[f] = life.found[f] || touched.includes(f) ? "user" : "default";
    const corrected = fields.filter(f => life.found[f] && JSON.stringify(life[f]) !== JSON.stringify(confirmDraft[f])).length;
    trackEvent(corrected > 0 ? "chat_parse_corrected" : "chat_parse_confirmed");
    setLife(confirmDraft);
    setLifeSources(sources);
    push("user", "맞아요");
    push("bot", "좋아요. 피부 변화랑 같이 보면 패턴이 더 잘 보일 거예요.");
    askConcern(0);
  };

  const answerConcern = (option: Option, spoken?: string) => {
    if (!currentConcern) return;
    if (spoken) push("user", spoken);
    else push("user", option.reply);
    setConcernScores(scores => ({ ...scores, [currentConcern]: option.score }));
    push("bot", `${concernLabel[currentConcern]}은 "${option.label}"로 받아들였어요. 이런 작은 변화도 기록해두면 나중에 꽤 도움이 돼요.`, true);
    const nextIndex = concernIndex + 1;
    setConcernIndex(nextIndex);
    setTimeout(() => askConcern(nextIndex), 320);
  };

  const submitSpokenConcern = (raw: string) => {
    const value = raw.trim();
    if (!value || !currentConcern) return;
    setText("");
    const matched = matchConcernOption(currentConcern, value);
    if (!matched) {
      push("user", value);
      push("bot", "말은 적어뒀는데 기록 기준으로 분류하기가 애매했어요. 예를 들어 '가라앉는 중', '새로 났어', '오래 지속돼'처럼 말해줘요.", true);
      return;
    }
    answerConcern(matched, value);
  };

  const saveLog = (note: string) => {
    const date = todayISO();
    if (session.completed || session.dailyLogs.some(log => log.date === date)) {
      push("bot", "오늘 기록은 이미 남겨두었어요. 내일 다시 만나요.");
      return;
    }
    const parsedLife = life ?? parseLife("", session.showMenstrualFactor);
    const sleep = sleepMeta[parsedLife.sleep];
    const exactMinutes = parsedLife.sleepMinutes;
    const wakeMinutes = exactMinutes !== undefined ? (23 * 60 + exactMinutes) % 1440 : null;
    const wakeLabel = wakeMinutes !== null ? `${String(Math.floor(wakeMinutes / 60)).padStart(2, "0")}:${String(wakeMinutes % 60).padStart(2, "0")}` : sleep.wakeTime;
    const allDefault: Partial<Record<LogField, FieldSource>> = { sleep: "default", emotions: "default", exercise: "default", context: "default", ampoule: "default" };
    const { empathy, keyword } = analyzeNote(note);
    const scores: Partial<Record<ConcernKey, number>> = {};
    session.selectedConcerns.forEach(k => {
      scores[k] = concernScores[k] ?? session.baselineScores[k] ?? 5;
    });

    const log: DailyLog = {
      day,
      date,
      concernScores: scores,
      ampouleUsed: parsedLife.ampoule,
      bedtime: exactMinutes !== undefined ? "23:00" : sleep.bedtime,
      wakeTime: wakeLabel,
      sleepMinutes: exactMinutes ?? sleep.minutes,
      sleepCategory: parsedLife.sleep,
      emotions: parsedLife.emotions,
      emotionStressScore: parsedLife.emotions.reduce((sum, e) => sum + EMOTION_SCORE[e], 0),
      exerciseType: parsedLife.exercise,
      exerciseMeta: EXERCISE_META[parsedLife.exercise],
      contextFactors: parsedLife.context,
      note,
      noteKeyword: keyword,
      sources: life ? lifeSources : allDefault,
    };

    const newLogs = [...session.dailyLogs, log];
    setSession({ ...session, dailyLogs: newLogs, completed: hasCompletedChallenge(newLogs) });
    push("bot", empathy);
    push("bot", `키워드는 #${keyword} 로 남겨둘게요.`);
    setTimeout(() => {
      push("bot", `기록 완료. Day ${day} 꽃이 조금 더 자랐어요.`);
      setPhase("done");
    }, 560);
  };

  const submitText = (raw = text) => {
    const value = raw.trim();
    if (!value) return;
    if (phase === "life") submitLife(value);
    else if (phase === "concern") submitSpokenConcern(value);
    else if (phase === "note") {
      setText("");
      push("user", value);
      setPhase("saving");
      setTimeout(() => saveLog(value), 500);
    }
  };

  const toggleMic = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      push("bot", "이 브라우저에서는 음성 입력을 바로 쓸 수 없어요. 텍스트로 적어줘도 같은 방식으로 이해할게요.", true);
      return;
    }
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText.trim()) {
        setText(prev => `${prev ? `${prev} ` : ""}${finalText.trim()}`);
      } else if (interimText.trim()) {
        setText(interimText.trim());
      }
    };
    rec.onerror = () => push("bot", "음성을 잘 듣지 못했어요. 한 번만 다시 말해줘요.", true);
    rec.onend = () => setRecording(false);
    try {
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
      push("bot", "음성 입력을 시작하지 못했어요. 텍스트로 이어가도 괜찮아요.", true);
    }
  };

  return (
    <div className="chat-daily-root fixed inset-0 flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden md:absolute md:inset-0 md:h-auto md:min-h-0">
      <header className="px-5 pt-[calc(env(safe-area-inset-top)+18px)] md:pt-6 pb-3 border-b border-white/60 bg-gradient-to-b from-white/35 to-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button onClick={onCancel} className="chat-top-chip px-3.5 py-2 text-[12px] text-plum/70">나가기</button>
          <span className="text-[11px] tracking-brand text-plum/70">SOOPSAI</span>
          <span className="chat-day-chip tnum text-[11px] font-bold px-3.5 py-2">DAY {day} / 7</span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <BloomFlower day={Math.max(0, day - 1)} size={56} />
          <div>
            <div className="font-serif text-[16px] text-plum">오늘의 회복 기록</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{bloomSub[day]}</div>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className={`chat-message-scroll px-4 space-y-3 ${
          phase === "life" && msgs.length <= 2 ? "pt-12 pb-6" : "pt-5 pb-6"
        }`}
      >
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`${
              phase === "life" && m.role === "bot" ? "max-w-[92%] px-5 py-4 text-[15px]" : "max-w-[84%] px-4 py-3 text-[14.5px]"
            } leading-[1.58] rounded-2xl ${
              m.role === "user"
                ? "glass-lucky text-plum rounded-br-sm"
                : m.subtle
                  ? "bg-white/25 border border-white/50 text-charcoal/58 rounded-bl-sm backdrop-blur-sm"
                  : "glass-surface text-charcoal rounded-bl-sm"
            }`}>
              {m.text}
            </div>
          </div>
        ))}

        {phase === "done" && (
          <button onClick={onDone} className="glass-lucky min-h-[48px] w-full rounded-full text-plum text-[14px] font-bold">
            {day >= 7 ? "7일 리포트 보기" : "오늘 기록 마치기"}
          </button>
        )}
      </div>

      {phase !== "done" && (
        <div className={`shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-2 bg-white/10 backdrop-blur-md ${phase === "life" ? "pt-3" : "pt-2"}`}>
          {phase !== "confirm" && <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              aria-label={recording ? "음성 입력 종료" : "음성 입력 시작"}
              className={`h-11 shrink-0 rounded-full grid place-items-center border transition ${
                recording ? "glass-lucky min-w-[88px] px-3 text-rose animate-pulse text-[12px] font-semibold" : "glass-pill w-11 text-forest"
              }`}
            >
              {recording ? (
                "종료"
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M19 11a7 7 0 01-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitText(); }}
              placeholder={phase === "life" ? "오늘 상태를 한 번에 말해줘요..." : phase === "concern" ? "피부 고민 변화를 말해줘요..." : "마지막 한 문장을 남겨줘요..."}
              className="glass-pill flex-1 min-h-[44px] rounded-full px-4 text-[14px] text-charcoal outline-none focus:border-rose"
            />
            <button
              onClick={() => submitText()}
              disabled={!text.trim() || phase === "saving"}
              aria-label="보내기"
              className="glass-lucky h-11 w-11 shrink-0 rounded-full text-plum grid place-items-center disabled:opacity-35"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20l16-8L4 4l3 8-3 8z" fill="currentColor" /></svg>
            </button>
          </div>}
          {phase === "confirm" && confirmDraft && life && (
            <ConfirmLife draft={confirmDraft} found={life.found} touched={touched} onChange={changeDraft} onConfirm={confirmLife} />
          )}
          {phase === "life" && (
            <div className="space-y-2">
              {lifeGroups.map(group => (
                <div key={group.title} className="flex items-start gap-2">
                  <div className="w-[38px] pt-2 text-[10px] font-semibold text-plum/48">{group.title}</div>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {group.items.map(item => (
                      <button
                        key={item}
                        onClick={() => setText(prev => `${prev ? `${prev}, ` : ""}${item}`)}
                        className="glass-pill min-h-[32px] min-w-[58px] px-2.5 rounded-full border text-[11.5px] font-semibold text-plum/80 transition active:scale-[0.98] whitespace-nowrap"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {phase === "concern" && currentConcern && (
            <div className="flex flex-wrap gap-2">
              {concernOptions[currentConcern].map(option => (
                <button
                  key={option.value}
                  onClick={() => answerConcern(option)}
                  className="glass-pill min-h-[38px] px-3.5 rounded-full border text-[12.5px] font-semibold text-plum/80 transition active:scale-[0.98]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EMOTION_CHOICES: EmotionKey[] = ["tired", "stressed", "sensitive", "anxious", "irritated", "calm", "fresh", "normal"];
const SLEEP_CHOICES: SleepCategory[] = ["under5", "fiveToSix", "sixToSeven", "overSeven"];

/** 문장에서 읽은 값을 눌러서 확인·수정하는 카드. 말하지 않은 항목은 "비워둠"으로 표시된다. */
function ConfirmLife({ draft, found, touched, onChange, onConfirm }: {
  draft: LifeDraft; found: Record<LogField, boolean>; touched: LogField[];
  onChange: (field: LogField, patch: Partial<LifeDraft>) => void; onConfirm: () => void;
}) {
  const chip = (active: boolean) => `min-h-[32px] px-2.5 rounded-full border text-[11.5px] font-semibold transition active:scale-[0.98] whitespace-nowrap ${active ? "glass-lucky text-plum" : "glass-pill text-plum/75"}`;
  const state = (f: LogField) => (found[f] || touched.includes(f) ? "" : " · 비워둠");
  const toggleEmotion = (e: EmotionKey) => {
    const has = draft.emotions.includes(e);
    const base = draft.emotions.filter(x => x !== "normal" || e === "normal");
    const next = has ? base.filter(x => x !== e) : [...base.filter(x => x !== "normal"), e].slice(-2);
    onChange("emotions", { emotions: next.length ? next : ["normal"] });
  };
  const toggleContext = (c: ContextKey) => {
    if (c === "none") return onChange("context", { context: ["none"] });
    const base = draft.context.filter(x => x !== "none");
    onChange("context", { context: base.includes(c) ? (base.filter(x => x !== c).length ? base.filter(x => x !== c) : ["none"]) : [...base, c] });
  };
  const confirmedEmotions = found.emotions || touched.includes("emotions");
  const confirmedContext = found.context || touched.includes("context");
  const confirmedExercise = found.exercise || touched.includes("exercise");
  const confirmedSleep = found.sleep || touched.includes("sleep");
  const confirmedAmpoule = found.ampoule || touched.includes("ampoule");
  return (
    <div className="max-h-[46dvh] space-y-2.5 overflow-y-auto pb-1" aria-label="읽어낸 내용 확인">
      <div className="flex items-start gap-2">
        <div className="w-[52px] shrink-0 pt-2 text-[10px] font-semibold text-plum/55">수면{state("sleep")}</div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {SLEEP_CHOICES.map(k => <button key={k} className={chip(confirmedSleep && draft.sleep === k)} onClick={() => onChange("sleep", { sleep: k, sleepMinutes: undefined })}>{sleepMeta[k].label}</button>)}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-[52px] shrink-0 pt-2 text-[10px] font-semibold text-plum/55">기분{state("emotions")}</div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {EMOTION_CHOICES.map(k => <button key={k} className={chip(confirmedEmotions && draft.emotions.includes(k))} onClick={() => toggleEmotion(k)}>{emotionLabel[k]}</button>)}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-[52px] shrink-0 pt-2 text-[10px] font-semibold text-plum/55">운동{state("exercise")}</div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {EXERCISE_KEYS.map(k => <button key={k} className={chip(confirmedExercise && draft.exercise === k)} onClick={() => onChange("exercise", { exercise: k })}>{exerciseLabel[k]}</button>)}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-[52px] shrink-0 pt-2 text-[10px] font-semibold text-plum/55">생활{state("context")}</div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {CONTEXT_KEYS.map(k => <button key={k} className={chip(confirmedContext && draft.context.includes(k))} onClick={() => toggleContext(k)}>{contextLabel[k]}</button>)}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-[52px] shrink-0 pt-2 text-[10px] font-semibold text-plum/55">앰플{state("ampoule")}</div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          <button className={chip(confirmedAmpoule && draft.ampoule)} onClick={() => onChange("ampoule", { ampoule: true })}>숲사이 사용</button>
          <button className={chip(confirmedAmpoule && !draft.ampoule)} onClick={() => onChange("ampoule", { ampoule: false })}>미사용</button>
        </div>
      </div>
      <button onClick={onConfirm} className="glass-lucky min-h-[46px] w-full rounded-full text-[14px] font-bold text-plum">맞아요, 다음으로</button>
    </div>
  );
}
