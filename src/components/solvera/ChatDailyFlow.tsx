import { useEffect, useRef, useState } from "react";
import { BloomFlower } from "./BloomFlower";
import {
  CONCERN_LABEL, CONTEXT_KEYS, CONTEXT_LABEL, EMOTION_KEYS, EMOTION_LABEL, EMOTION_SCORE,
  EXERCISE_KEYS, EXERCISE_LABEL, EXERCISE_META,
  type ConcernKey, type ContextKey, type DailyLog, type EmotionKey, type ExerciseKey,
  type RecoverySession, type SleepCategory,
} from "@/lib/solvera/types";
import { todayISO } from "@/lib/solvera/storage";
import { analyzeNote } from "@/lib/solvera/keyword";

/* ---------------------------------------------------------------------------
   대화형(챗봇) 7일 기록 — 정형 데이터(피부/수면/생활습관)는 반드시 칩 선택,
   마지막에 "오늘 하루 한마디"만 자유 입력(텍스트 + 음성).
--------------------------------------------------------------------------- */

const BLOOM_SUB: Record<number, string> = {
  1: "찔레꽃 봉오리가 이제 막 맺혔어요",
  2: "봉오리가 조금씩 단단해지고 있어요",
  3: "꽃잎 끝이 살짝 열리기 시작했어요",
  4: "절반쯤 피어났어요",
  5: "향이 느껴질 만큼 피어났어요",
  6: "거의 다 피었어요, 하루 남았어요",
  7: "활짝 피었습니다 — 7일의 기록 완성",
};

type Msg = { id: number; role: "bot" | "user"; text: string; kind?: "keyword" };

type Option = { value: string; label: string };
type Question = {
  key: string;
  prompt: string;
  hint?: string;
  options: Option[];
  multi: boolean;
  max?: number;
  noneValue?: string;
};

const SLEEP_OPTIONS: { value: SleepCategory; label: string; bedtime: string; wakeTime: string }[] = [
  { value: "overSeven", label: "7시간 이상", bedtime: "23:00", wakeTime: "07:00" },
  { value: "sixToSeven", label: "6~7시간", bedtime: "23:40", wakeTime: "06:20" },
  { value: "fiveToSix", label: "5~6시간", bedtime: "00:30", wakeTime: "06:00" },
  { value: "under5", label: "5시간 미만", bedtime: "01:30", wakeTime: "05:30" },
];

const SCORE_OPTIONS: Option[] = [
  { value: "2", label: "거의 없음" },
  { value: "4", label: "약간" },
  { value: "6", label: "보통" },
  { value: "8", label: "심함" },
  { value: "10", label: "매우 심함" },
];

function buildQuestions(session: RecoverySession): Question[] {
  const qs: Question[] = [];
  session.selectedConcerns.forEach(k => {
    qs.push({
      key: `concern:${k}`,
      prompt: `오늘 «${CONCERN_LABEL[k]}»은(는) 어땠어요?`,
      hint: "가장 가까운 정도를 하나 골라주세요.",
      options: SCORE_OPTIONS, multi: false,
    });
  });
  qs.push({
    key: "ampoule",
    prompt: "오늘 리커버리 앰플을 사용하셨나요?",
    options: [{ value: "yes", label: "사용함" }, { value: "no", label: "사용하지 않음" }],
    multi: false,
  });
  qs.push({
    key: "sleep",
    prompt: "어젯밤 수면은 어떠셨나요?",
    options: SLEEP_OPTIONS.map(o => ({ value: o.value, label: o.label })),
    multi: false,
  });
  qs.push({
    key: "emotion",
    prompt: "오늘 마음은 어땠나요?",
    hint: "최대 2개까지 고를 수 있어요.",
    options: EMOTION_KEYS.map(k => ({ value: k, label: EMOTION_LABEL[k] })),
    multi: true, max: 2,
  });
  qs.push({
    key: "exercise",
    prompt: "오늘 몸을 움직였나요?",
    options: EXERCISE_KEYS.map(k => ({ value: k, label: EXERCISE_LABEL[k] })),
    multi: false,
  });
  qs.push({
    key: "context",
    prompt: "오늘 해당하는 생활 습관이 있다면 알려주세요.",
    hint: "운동·음주·클렌징·생리 전후 등, 여러 개 선택 가능해요.",
    options: CONTEXT_KEYS.filter(k => k !== "menstrual" || session.showMenstrualFactor)
      .map(k => ({ value: k, label: CONTEXT_LABEL[k] })),
    multi: true, noneValue: "none",
  });
  return qs;
}

export function ChatDailyFlow({ session, setSession, onDone, onCancel }: {
  session: RecoverySession;
  setSession: (s: RecoverySession) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const day = Math.min(session.dailyLogs.length + 1, 7);
  const questions = useRef(buildQuestions(session)).current;

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [qi, setQi] = useState(0);
  const [typing, setTyping] = useState(true);
  const [phase, setPhase] = useState<"chips" | "note" | "done">("chips");
  const [picked, setPicked] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  const push = (role: Msg["role"], t: string, kind?: Msg["kind"]) =>
    setMsgs(m => [...m, { id: ++idRef.current, role, text: t, kind }]);

  // Bot asks the current question after a short typing beat
  useEffect(() => {
    if (phase !== "chips") return;
    const q = questions[qi];
    if (!q) return;
    setTyping(true);
    setPicked([]);
    const t = setTimeout(() => {
      setTyping(false);
      push("bot", qi === 0 ? `안녕하세요, Day ${day}이에요 🌿 ${q.prompt}` : q.prompt);
      if (q.hint) push("bot", q.hint);
    }, 480);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, phase, picked]);

  const current = questions[qi];

  const toggle = (v: string) => {
    if (!current) return;
    if (!current.multi) { setPicked([v]); return; }
    if (current.noneValue && v === current.noneValue) {
      setPicked(picked.includes(v) ? [] : [v]);
      return;
    }
    if (picked.includes(v)) setPicked(picked.filter(x => x !== v));
    else {
      const base = current.noneValue ? picked.filter(x => x !== current.noneValue) : picked;
      if (current.max && base.length >= current.max) return;
      setPicked([...base, v]);
    }
  };

  const confirm = () => {
    if (!current || !picked.length) return;
    const labels = picked.map(v => current.options.find(o => o.value === v)?.label ?? v);
    push("user", labels.join(", "));
    setAnswers(a => ({ ...a, [current.key]: picked }));
    if (qi + 1 < questions.length) setQi(qi + 1);
    else {
      setPhase("note");
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        push("bot", "오늘 하루, 한마디로 남겨볼까요?");
        push("bot", "말하기(🎙) 또는 입력, 편한 대로요. 이 내용은 감성 요약으로만 담겨요.");
      }, 480);
    }
  };

  const saveLog = (note: string, keyword: string) => {
    const concernScores: Partial<Record<ConcernKey, number>> = {};
    session.selectedConcerns.forEach(k => {
      const v = answers[`concern:${k}`]?.[0];
      concernScores[k] = v ? Number(v) : (session.baselineScores[k] ?? 5);
    });
    const sleep = SLEEP_OPTIONS.find(o => o.value === (answers.sleep?.[0] as SleepCategory)) ?? SLEEP_OPTIONS[1];
    const sleepMinutes = { overSeven: 480, sixToSeven: 400, fiveToSix: 330, under5: 240 }[sleep.value];
    const emotions = (answers.emotion ?? []) as EmotionKey[];
    const exercise = (answers.exercise?.[0] ?? "none") as ExerciseKey;
    const context = ((answers.context?.length ? answers.context : ["none"]) as ContextKey[]);

    const log: DailyLog = {
      day, date: todayISO(),
      concernScores,
      ampouleUsed: answers.ampoule?.[0] === "yes",
      bedtime: sleep.bedtime, wakeTime: sleep.wakeTime,
      sleepMinutes, sleepCategory: sleep.value,
      emotions,
      emotionStressScore: emotions.reduce((s, e) => s + EMOTION_SCORE[e], 0),
      exerciseType: exercise,
      exerciseMeta: EXERCISE_META[exercise],
      contextFactors: context,
      note, noteKeyword: keyword,
    };
    const newLogs = [...session.dailyLogs, log];
    setSession({ ...session, dailyLogs: newLogs, completed: newLogs.length >= 7 });
  };

  const submitNote = (raw: string) => {
    const note = raw.trim();
    if (!note || phase !== "note") return;
    setText("");
    push("user", note);
    setPhase("done");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const { empathy, keyword } = analyzeNote(note);
      push("bot", empathy);
      push("bot", `오늘의 키워드로 #${keyword} 를 리포트에 담을게요`, "keyword");
      setTimeout(() => {
        push("bot", `기록 완료! Day ${day}의 봉오리가 자랐어요 🌱`);
        saveLog(note, keyword);
      }, 700);
    }, 800);
  };

  const toggleMic = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      push("bot", "이 브라우저에서는 음성 인식이 지원되지 않아요. 텍스트로 입력해주셔도 괜찮아요 🙏");
      return;
    }
    if (recording) { recRef.current?.stop(); return; }

    const rec = new SR();
    recRef.current = rec;
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => submitNote(e.results[0][0].transcript);
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        push("bot", "마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용한 뒤 다시 눌러주세요 🎙️");
      else if (e.error === "no-speech") push("bot", "소리가 잘 안 들렸어요. 다시 한 번 눌러서 말씀해주시겠어요?");
      else push("bot", "음성 인식 중 문제가 생겼어요. 텍스트로 입력해주셔도 괜찮아요.");
    };
    rec.onend = () => setRecording(false);
    try { rec.start(); setRecording(true); }
    catch { setRecording(false); push("bot", "음성 인식을 시작할 수 없었어요. 텍스트로 입력해주셔도 괜찮아요."); }
  };

  const savedDone = phase === "done" && session.dailyLogs.some(l => l.day === day);

  return (
    <div className="min-h-full flex flex-col h-full">
      {/* Header — bloom grows with the day */}
      <header className="px-5 pt-[calc(env(safe-area-inset-top)+18px)] md:pt-6 pb-3 border-b border-border bg-gradient-to-b from-secondary to-ivory">
        <div className="flex items-center justify-between">
          <button onClick={onCancel} className="text-[12px] text-muted-foreground underline underline-offset-2">나가기</button>
          <span className="text-[11px] tracking-brand text-plum/70">SOLVÉRA</span>
          <span className="tnum text-[11px] font-semibold text-rose bg-rose/15 px-2.5 py-1 rounded-full">DAY {day} / 7</span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <BloomFlower day={day} size={56} />
          <div>
            <div className="font-serif text-[16px] text-plum">오늘의 회복 기록</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">{BLOOM_SUB[day]}</div>
          </div>
        </div>
        <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${(day / 7) * 100}%`, background: "linear-gradient(90deg, var(--rose), var(--forest))" }} />
        </div>
      </header>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {msgs.map(m => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.kind === "keyword" ? (
              <div className="max-w-[86%] rounded-2xl border border-rose bg-rose/15 px-4 py-3 text-[13px] text-plum">
                🌸 {m.text}
              </div>
            ) : (
              <div className={`max-w-[82%] px-4 py-3 text-[14.5px] leading-[1.55] rounded-2xl ${
                m.role === "user"
                  ? "bg-forest text-ivory rounded-br-sm"
                  : "bg-card border border-border text-charcoal rounded-bl-sm"
              }`}>
                {m.text}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 text-charcoal/40 text-[14px]">···</div>
          </div>
        )}

        {/* Chips for the active structured question */}
        {phase === "chips" && !typing && current && (
          <div className="flex flex-wrap gap-2 pt-1">
            {current.options.map(o => {
              const active = picked.includes(o.value);
              return (
                <button key={o.value} onClick={() => toggle(o.value)}
                  className={`min-h-[40px] px-3.5 rounded-full border text-[13px] font-semibold transition ${
                    active ? "bg-rose text-ivory border-rose" : "bg-card text-plum border-rose/50"
                  }`}>
                  {o.label}
                </button>
              );
            })}
            <button onClick={confirm} disabled={!picked.length}
              className="min-h-[40px] px-4 rounded-full bg-forest text-ivory text-[13px] font-semibold disabled:opacity-35">
              선택 완료 →
            </button>
          </div>
        )}

        {savedDone && (
          <div className="pt-3">
            <button onClick={onDone}
              className="min-h-[48px] w-full rounded-xl bg-plum text-ivory text-[14px] font-medium">
              {day >= 7 ? "7일 리포트 보기" : "오늘 기록 마치기"}
            </button>
          </div>
        )}
      </div>

      {/* Free-form input (text + voice) — only for 오늘 하루 한마디 */}
      {phase === "note" && (
        <div className="border-t border-border bg-ivory px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] flex items-center gap-2">
          <button onClick={toggleMic} aria-label="음성 입력"
            className={`h-11 w-11 shrink-0 rounded-full grid place-items-center border transition ${
              recording ? "bg-rose text-ivory border-rose animate-pulse" : "bg-card text-forest border-border"
            }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M19 11a7 7 0 01-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitNote(text); }}
            placeholder="말하거나 입력해보세요..."
            className="flex-1 min-h-[44px] rounded-full border border-border bg-card px-4 text-[14px] text-charcoal outline-none focus:border-rose" />
          <button onClick={() => submitNote(text)} disabled={!text.trim()} aria-label="보내기"
            className="h-11 w-11 shrink-0 rounded-full bg-forest text-ivory grid place-items-center disabled:opacity-35">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20l16-8L4 4l3 8-3 8z" fill="currentColor"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
