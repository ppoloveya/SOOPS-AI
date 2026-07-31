import { useEffect, useMemo, useState } from "react";
import { BloomFlower } from "./BloomFlower";
import { SleepDial } from "./SleepDial";
import { ChatDailyFlow } from "./ChatDailyFlow";
import {
  CONCERN_KEYS, CONCERN_LABEL, EMOTION_KEYS, EMOTION_LABEL, EMOTION_SCORE,
  EXERCISE_KEYS, EXERCISE_LABEL, EXERCISE_META, CONTEXT_KEYS, CONTEXT_LABEL,
  type ConcernKey, type EmotionKey, type ExerciseKey, type ContextKey,
  type RecoverySession, type SkinType, type CurrentCondition, type DailyLog,
} from "@/lib/solvera/types";
import { loadSession, saveSession, clearSession, todayISO } from "@/lib/solvera/storage";
import { buildDemoSession } from "@/lib/solvera/demo";
import { topKeyword } from "@/lib/solvera/keyword";
import {
  concernResults, averageImprovement, ampouleUsageRate, completionRate,
  lifestyleFactors, recoveryType, nextWeekSuggestion, sleepMinutesFromTimes, sleepCategoryFrom,
} from "@/lib/solvera/analysis";

// dev-mode flag: allow "next day" without waiting for calendar day
const DEV_MODE = true;

type Phase =
  | "landing" | "consent" | "profile" | "concerns" | "baseline" | "dashboard"
  | "daily" | "chat-daily" | "day-complete" | "report";

export function SolveraApp() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [session, setSession] = useState<RecoverySession | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (s) setSession(s);
  }, []);

  useEffect(() => {
    if (session && !demoMode) saveSession(session);
  }, [session, demoMode]);

  const startFresh = () => {
    const s: RecoverySession = {
      version: 1, id: crypto.randomUUID(), startedAt: new Date().toISOString(),
      skinType: "unknown", sensitivity: 3, currentCondition: "same",
      showMenstrualFactor: false, selectedConcerns: [], baselineScores: {},
      dailyLogs: [], completed: false,
    };
    setSession(s); setDemoMode(false); setPhase("consent");
  };

  const resumeSession = () => {
    if (!session) return;
    if (session.completed) setPhase("report");
    else if (!session.selectedConcerns.length) setPhase("profile");
    else if (!Object.keys(session.baselineScores).length) setPhase("baseline");
    else setPhase("dashboard");
  };

  const showDemo = () => {
    setSession(buildDemoSession()); setDemoMode(true); setPhase("report");
  };

  const resetAll = () => {
    if (!confirm("모든 기록을 초기화하시겠어요? 되돌릴 수 없습니다.")) return;
    clearSession(); setSession(null); setDemoMode(false); setPhase("landing");
  };

  return (
    <div className="min-h-full text-charcoal font-sans">
      {phase === "landing" && <Landing hasSession={!!session} onStart={startFresh} onResume={resumeSession} onDemo={showDemo} />}
      {phase === "consent" && session && <Consent onBack={() => setPhase("landing")} onNext={() => setPhase("profile")} />}
      {phase === "profile" && session && <Profile session={session} setSession={setSession} onNext={() => setPhase("concerns")} onBack={() => setPhase("consent")} />}
      {phase === "concerns" && session && <ConcernsPick session={session} setSession={setSession} onNext={() => setPhase("baseline")} onBack={() => setPhase("profile")} />}
      {phase === "baseline" && session && <Baseline session={session} setSession={setSession} onNext={() => setPhase("dashboard")} onBack={() => setPhase("concerns")} />}
      {phase === "dashboard" && session && <Dashboard session={session} setSession={setSession} onDaily={() => setPhase("daily")} onChatDaily={() => setPhase("chat-daily")} onReport={() => setPhase("report")} onReset={resetAll} />}
      {phase === "chat-daily" && session && <ChatDailyFlow session={session} setSession={setSession} onDone={() => setPhase("day-complete")} onCancel={() => setPhase("dashboard")} />}
      {phase === "daily" && session && <DailyFlow session={session} setSession={setSession} onDone={() => setPhase("day-complete")} onCancel={() => setPhase("dashboard")} />}
      {phase === "day-complete" && session && <DayComplete session={session} onContinue={() => setPhase("dashboard")} />}
      {phase === "report" && session && <Report session={session} demoMode={demoMode} onBack={() => demoMode ? setPhase("landing") : setPhase("dashboard")} onReset={resetAll} />}
    </div>
  );
}

/* =============================================================================
   Shared UI
============================================================================= */
function Screen({ children, footer, header }: { children: React.ReactNode; footer?: React.ReactNode; header?: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      {header}
      <main className="flex-1 px-5 pb-40 pt-5">{children}</main>
      {footer && (
        <div className="fixed bottom-0 left-0 right-0 md:absolute px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] bg-gradient-to-t from-ivory via-ivory to-ivory/90 no-print">
          <div className="mx-auto md:max-w-[360px]">{footer}</div>
        </div>
      )}
    </div>
  );
}

function TopBar({ title, subtitle, onBack }: { title?: string; subtitle?: string; onBack?: () => void }) {
  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top)+18px)] md:pt-6 pb-2 flex items-center gap-3">
      {onBack ? (
        <button onClick={onBack} className="h-11 w-11 -ml-2 rounded-full flex items-center justify-center text-charcoal/70 hover:bg-black/5" aria-label="뒤로">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      ) : <div className="w-11" />}
      <div className="flex-1 min-w-0 text-center">
        {subtitle && <div className="text-[11px] tracking-brand text-muted-foreground uppercase">{subtitle}</div>}
        {title && <div className="font-serif text-[17px] mt-0.5 truncate">{title}</div>}
      </div>
      <div className="w-11" />
    </header>
  );
}

function PrimaryButton({ children, onClick, disabled, variant = "primary" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "ghost" | "outline" }) {
  const base = "w-full min-h-[52px] rounded-xl px-5 font-medium text-[15px] transition disabled:opacity-40 disabled:cursor-not-allowed";
  const style = variant === "primary"
    ? "bg-plum text-ivory shadow-[0_4px_14px_-4px_rgba(36,21,43,0.4)]"
    : variant === "outline"
      ? "bg-transparent border border-plum/25 text-plum"
      : "bg-transparent text-plum/80";
  return <button className={`${base} ${style}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border/70 shadow-[0_1px_0_rgba(0,0,0,0.02)] p-4 ${className}`}>
      {children}
    </div>
  );
}

function FieldRecordLabel({ n }: { n: string }) {
  return <div className="text-[10px] tracking-brand text-muted-foreground uppercase">FIELD RECORD · {n}</div>;
}

/* =============================================================================
   LANDING
============================================================================= */
function Landing({ hasSession, onStart, onResume, onDemo }: { hasSession: boolean; onStart: () => void; onResume: () => void; onDemo: () => void }) {
  return (
    <Screen>
      <div className="flex flex-col items-center text-center pt-8">
        <div className="text-[11px] tracking-brand text-muted-foreground uppercase">RECOVERY RECORD · N°001</div>
        <div className="mt-3 font-serif tracking-[0.3em] text-[22px] text-plum">SOLVÉRA</div>
        <h1 className="mt-8 font-serif text-[28px] leading-[1.3] text-plum">
          피부가 다시<br/>피어나는 7일
        </h1>
        <p className="mt-4 text-[14px] leading-[1.6] text-charcoal/70 max-w-[300px]">
          피부 상태와 일상의 흔적을 기록하고<br/>나만의 리커버리 리포트를 확인하세요.
        </p>

        <div className="mt-8">
          <BloomFlower day={7} size={180} />
        </div>

        <div className="w-full mt-6 space-y-3">
          <PrimaryButton onClick={onStart}>7일 기록 시작하기</PrimaryButton>
          {hasSession && <PrimaryButton onClick={onResume} variant="outline">이어서 기록하기</PrimaryButton>}
          <PrimaryButton onClick={onDemo} variant="ghost">데모 리포트 보기</PrimaryButton>
        </div>

        <p className="mt-8 text-[11px] leading-[1.5] text-muted-foreground max-w-[280px]">
          본 서비스는 의료적 진단·치료 목적이 아닌<br/>사용자 셀프 기록 리포트입니다.
        </p>
      </div>
    </Screen>
  );
}

/* =============================================================================
   CONSENT
============================================================================= */
function Consent({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Screen
      header={<TopBar subtitle="STEP 01" title="사용 안내" onBack={onBack} />}
      footer={<PrimaryButton onClick={onNext} disabled={!ok}>동의하고 시작</PrimaryButton>}
    >
      <FieldRecordLabel n="INFO" />
      <h2 className="font-serif text-[24px] leading-tight text-plum mt-2">시작하기 전에</h2>
      <div className="mt-6 space-y-3">
        {[
          ["하루 약 30~45초", "부담 없는 짧은 기록으로 진행돼요."],
          ["7일 동안 기록", "매일 조금씩, 7일의 변화를 관찰해요."],
          ["셀프 리포트", "직접 입력한 내용을 기반으로 한 개인 리포트예요."],
          ["기기에 저장", "데이터는 현재 브라우저에만 저장돼요."],
          ["진단이 아닙니다", "의료적 진단·치료 결과가 아니에요."],
        ].map(([t, d]) => (
          <Card key={t} className="flex gap-3">
            <div className="mt-1 w-2 h-2 rounded-full bg-rose shrink-0" />
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-plum">{t}</div>
              <div className="text-[13px] text-charcoal/70 mt-0.5">{d}</div>
            </div>
          </Card>
        ))}
      </div>

      <label className="mt-8 flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer">
        <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-1 h-5 w-5 accent-plum" />
        <span className="text-[13px] leading-[1.5] text-charcoal/80">
          위 내용을 확인했으며, 셀프 기록 리포트 목적으로 데이터를 이 기기에 저장하는 것에 동의해요.
        </span>
      </label>
    </Screen>
  );
}

/* =============================================================================
   PROFILE
============================================================================= */
function Profile({ session, setSession, onNext, onBack }: { session: RecoverySession; setSession: (s: RecoverySession) => void; onNext: () => void; onBack: () => void }) {
  const skinOpts: { v: SkinType; label: string }[] = [
    { v: "dry", label: "건성" }, { v: "oily", label: "지성" }, { v: "combo", label: "복합성" },
    { v: "normal", label: "중성" }, { v: "unknown", label: "잘 모르겠음" },
  ];
  const condOpts: { v: CurrentCondition; label: string }[] = [
    { v: "worse", label: "평소보다 나쁨" }, { v: "same", label: "평소와 비슷함" }, { v: "better", label: "평소보다 좋음" },
  ];
  const ready = session.skinType && session.currentCondition;
  return (
    <Screen
      header={<TopBar subtitle="STEP 02" title="기본 피부 정보" onBack={onBack} />}
      footer={<PrimaryButton onClick={onNext} disabled={!ready}>다음</PrimaryButton>}
    >
      <FieldRecordLabel n="PROFILE" />
      <h2 className="font-serif text-[22px] text-plum mt-2 mb-6">피부에 대해 알려주세요</h2>

      <Section title="피부 타입">
        <div className="grid grid-cols-2 gap-2">
          {skinOpts.map(o => (
            <Chip key={o.v} active={session.skinType === o.v} onClick={() => setSession({ ...session, skinType: o.v })}>{o.label}</Chip>
          ))}
        </div>
      </Section>

      <Section title="평소 민감도">
        <div className="flex items-center gap-2">
          {[1,2,3,4,5].map(n => (
            <button key={n}
              onClick={() => setSession({ ...session, sensitivity: n })}
              className={`flex-1 h-14 rounded-xl border text-[16px] tnum font-medium ${session.sensitivity === n ? "bg-plum text-ivory border-plum" : "bg-card border-border text-charcoal/70"}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-2 px-1">
          <span>낮음</span><span>높음</span>
        </div>
      </Section>

      <Section title="현재 피부 상태">
        <div className="space-y-2">
          {condOpts.map(o => (
            <Chip key={o.v} active={session.currentCondition === o.v} onClick={() => setSession({ ...session, currentCondition: o.v })} block>{o.label}</Chip>
          ))}
        </div>
      </Section>

      <Section title="생리 관련 항목">
        <div className="grid grid-cols-2 gap-2">
          <Chip active={session.showMenstrualFactor} onClick={() => setSession({ ...session, showMenstrualFactor: true })}>표시하기</Chip>
          <Chip active={!session.showMenstrualFactor} onClick={() => setSession({ ...session, showMenstrualFactor: false })}>표시하지 않기</Chip>
        </div>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <div className="text-[13px] font-medium text-plum mb-3">{title}</div>
      {children}
    </div>
  );
}

function Chip({ children, active, onClick, block }: { children: React.ReactNode; active?: boolean; onClick?: () => void; block?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`${block ? "w-full" : ""} min-h-[48px] px-4 rounded-xl border text-[14px] font-medium transition ${
        active ? "bg-plum text-ivory border-plum" : "bg-card border-border text-charcoal/75"
      }`}
    >{children}</button>
  );
}

/* =============================================================================
   CONCERNS PICK
============================================================================= */
function ConcernsPick({ session, setSession, onNext, onBack }: { session: RecoverySession; setSession: (s: RecoverySession) => void; onNext: () => void; onBack: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (k: ConcernKey) => {
    const cur = session.selectedConcerns;
    if (cur.includes(k)) {
      setSession({ ...session, selectedConcerns: cur.filter(x => x !== k) });
    } else {
      if (cur.length >= 3) { setMsg("최대 3개까지 선택할 수 있어요."); setTimeout(() => setMsg(null), 1600); return; }
      setSession({ ...session, selectedConcerns: [...cur, k] });
    }
  };
  return (
    <Screen
      header={<TopBar subtitle="STEP 03" title="주요 피부 고민" onBack={onBack} />}
      footer={<PrimaryButton onClick={onNext} disabled={session.selectedConcerns.length === 0}>다음</PrimaryButton>}
    >
      <FieldRecordLabel n="CONCERNS" />
      <div className="flex items-baseline justify-between mt-2 mb-6">
        <h2 className="font-serif text-[22px] text-plum">가장 신경 쓰는 부분</h2>
        <div className="text-[13px] text-muted-foreground tnum">{session.selectedConcerns.length}/3</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CONCERN_KEYS.map(k => (
          <button key={k} onClick={() => toggle(k)}
            className={`relative min-h-[64px] p-3 rounded-xl border text-[14px] font-medium text-left transition ${
              session.selectedConcerns.includes(k) ? "bg-rose/15 border-rose text-plum" : "bg-card border-border text-charcoal/75"
            }`}>
            {CONCERN_LABEL[k]}
            {session.selectedConcerns.includes(k) && (
              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose text-ivory grid place-items-center text-[11px]">✓</span>
            )}
          </button>
        ))}
      </div>

      {msg && <div className="mt-4 text-center text-[12px] text-destructive">{msg}</div>}
      <p className="mt-6 text-[12px] text-muted-foreground text-center">최소 1개, 최대 3개까지 선택해주세요.</p>
    </Screen>
  );
}

/* =============================================================================
   BASELINE
============================================================================= */
function Baseline({ session, setSession, onNext, onBack }: { session: RecoverySession; setSession: (s: RecoverySession) => void; onNext: () => void; onBack: () => void }) {
  const scores = session.baselineScores;
  const setScore = (k: ConcernKey, v: number) => setSession({ ...session, baselineScores: { ...scores, [k]: v } });
  const ready = session.selectedConcerns.every(k => typeof scores[k] === "number");
  return (
    <Screen
      header={<TopBar subtitle="STEP 04" title="시작 점수" onBack={onBack} />}
      footer={<PrimaryButton onClick={onNext} disabled={!ready}>기록 시작하기</PrimaryButton>}
    >
      <FieldRecordLabel n="BASELINE" />
      <h2 className="font-serif text-[22px] text-plum mt-2 mb-2">지금의 불편 정도를 알려주세요</h2>
      <p className="text-[13px] text-charcoal/60 mb-6">0은 불편 없음, 10은 매우 불편함이에요.</p>

      <div className="space-y-4">
        {session.selectedConcerns.map(k => (
          <ScoreCard key={k} label={CONCERN_LABEL[k]} value={scores[k] ?? null} onChange={v => setScore(k, v)} />
        ))}
      </div>
    </Screen>
  );
}

function ScoreCard({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  const v = value ?? 5;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <div className="text-[14px] font-medium text-plum">{label}</div>
        <div className="tnum text-[28px] font-bold text-plum">{value ?? "–"}<span className="text-[13px] text-muted-foreground font-normal">/10</span></div>
      </div>
      <input type="range" min={0} max={10} step={1} value={v}
        onChange={e => onChange(Number(e.target.value))}
        className="brand-slider mt-2" />
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 mt-0.5">
        <span>0</span><span>5</span><span>10</span>
      </div>
    </Card>
  );
}

/* =============================================================================
   DASHBOARD
============================================================================= */
function Dashboard({ session, setSession, onDaily, onChatDaily, onReport, onReset }: { session: RecoverySession; setSession: (s: RecoverySession) => void; onDaily: () => void; onChatDaily: () => void; onReport: () => void; onReset: () => void }) {
  const done = session.dailyLogs.length;
  const day = Math.min(done + 1, 7);
  const canDaily = done < 7;
  const canReport = done >= 7 || session.completed;
  const todayLogged = session.dailyLogs.some(l => l.date === todayISO());

  const advanceDay = () => {
    // dev-only: nothing to advance; days are just count of logs. This helper is a no-op button
    // but we can simulate 'passing a day' by allowing another daily entry immediately.
    // Just navigate to daily.
    onDaily();
  };

  return (
    <Screen
      header={<TopBar subtitle={`DAY ${day} / 7`} title="리커버리 진행" />}
    >
      <FieldRecordLabel n="DASHBOARD" />
      <div className="mt-3 flex items-center justify-between">
        <div>
          <div className="font-serif text-[26px] text-plum leading-tight">DAY {day}</div>
          <div className="text-[13px] text-muted-foreground mt-1">개화까지 {Math.max(0, 7 - done)}일 남았어요</div>
        </div>
        <BloomFlower day={day} size={120} />
      </div>

      <Card className="mt-6">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-2">
          <span>진행률</span><span className="tnum">{done}/7</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-rose transition-all" style={{ width: `${(done/7)*100}%` }} />
        </div>
        <div className="grid grid-cols-7 gap-1.5 mt-4">
          {Array.from({length: 7}).map((_, i) => {
            const n = i + 1;
            const log = session.dailyLogs[i];
            const isDone = !!log;
            const isCurrent = n === day && !isDone;
            return (
              <div key={n} className={`aspect-square rounded-lg flex flex-col items-center justify-center border ${
                isDone ? "bg-plum text-ivory border-plum" :
                isCurrent ? "bg-rose/20 border-rose text-plum" :
                "bg-card border-border text-charcoal/40"
              }`}>
                <div className="text-[10px] tracking-brand">DAY</div>
                <div className="tnum text-[14px] font-bold">{n}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {canDaily && (
          todayLogged && !DEV_MODE
            ? <div className="text-center text-[13px] text-muted-foreground py-3">오늘 기록을 완료했어요. 내일 다시 만나요.</div>
            : (
              <>
                <PrimaryButton onClick={onChatDaily}>대화형으로 기록하기</PrimaryButton>
                <PrimaryButton onClick={onDaily} variant="outline">기존 단계별로 기록하기</PrimaryButton>
              </>
            )
        )}
        {canReport && <PrimaryButton onClick={onReport} variant={canDaily ? "outline" : "primary"}>최종 리포트 보기</PrimaryButton>}
        {!canReport && DEV_MODE && (
          <PrimaryButton onClick={advanceDay} variant="ghost">
            (개발 모드) 다음 날 기록하기
          </PrimaryButton>
        )}
      </div>

      {session.dailyLogs.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] tracking-brand text-muted-foreground uppercase mb-2">기록된 날짜</div>
          <div className="space-y-1.5">
            {session.dailyLogs.map(l => (
              <div key={l.day} className="flex justify-between text-[13px] py-2 px-3 rounded-lg bg-card border border-border">
                <span className="text-plum">DAY {l.day}</span>
                <span className="tnum text-muted-foreground">{l.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onReset} className="mt-10 mx-auto block text-[12px] text-muted-foreground underline underline-offset-2">기록 초기화</button>
      {/* dev helper: hidden void reference */}
      <span className="hidden">{void setSession}</span>
    </Screen>
  );
}

/* =============================================================================
   DAILY FLOW (5 steps)
============================================================================= */
function DailyFlow({ session, setSession, onDone, onCancel }: { session: RecoverySession; setSession: (s: RecoverySession) => void; onDone: () => void; onCancel: () => void }) {
  const day = Math.min(session.dailyLogs.length + 1, 7);
  const [step, setStep] = useState(1);

  // Draft state — only persisted on final save
  const [concernScores, setConcernScores] = useState<Partial<Record<ConcernKey, number>>>(() => {
    const o: Partial<Record<ConcernKey, number>> = {};
    session.selectedConcerns.forEach(k => { o[k] = session.baselineScores[k] ?? 5; });
    return o;
  });
  const [ampoule, setAmpoule] = useState<boolean | null>(null);
  const [bedtime, setBedtime] = useState("23:30");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [emotions, setEmotions] = useState<EmotionKey[]>([]);
  const [exercise, setExercise] = useState<ExerciseKey | null>(null);
  const [context, setContext] = useState<ContextKey[]>([]);
  const [warn, setWarn] = useState<string | null>(null);

  const showToast = (m: string) => { setWarn(m); setTimeout(() => setWarn(null), 1500); };

  const save = () => {
    const sleepMin = sleepMinutesFromTimes(bedtime, wakeTime);
    const log: DailyLog = {
      day, date: todayISO(),
      concernScores, ampouleUsed: !!ampoule,
      bedtime, wakeTime,
      sleepMinutes: sleepMin,
      sleepCategory: sleepCategoryFrom(sleepMin),
      emotions,
      emotionStressScore: emotions.reduce((s, e) => s + EMOTION_SCORE[e], 0),
      exerciseType: exercise ?? "none",
      exerciseMeta: EXERCISE_META[exercise ?? "none"],
      contextFactors: context.length ? context : ["none"],
    };
    const newLogs = [...session.dailyLogs, log];
    const completed = newLogs.length >= 7;
    setSession({ ...session, dailyLogs: newLogs, completed });
    onDone();
  };

  const stepReady = (() => {
    if (step === 1) return session.selectedConcerns.every(k => typeof concernScores[k] === "number") && ampoule !== null;
    if (step === 2) return !!bedtime && !!wakeTime;
    if (step === 3) return emotions.length > 0;
    if (step === 4) return exercise !== null;
    if (step === 5) return context.length > 0;
    return false;
  })();

  const next = () => step < 5 ? setStep(step + 1) : save();
  const back = () => step > 1 ? setStep(step - 1) : onCancel();

  const stepTitles = ["오늘의 피부", "수면", "오늘의 감정", "운동", "오늘의 환경"];

  return (
    <Screen
      header={<TopBar subtitle={`DAY ${day} · ${step}/5`} title={stepTitles[step - 1]} onBack={back} />}
      footer={
        <div className="space-y-2">
          {warn && <div className="text-center text-[12px] text-destructive">{warn}</div>}
          <PrimaryButton onClick={next} disabled={!stepReady}>
            {step < 5 ? "다음" : "오늘 기록 완료"}
          </PrimaryButton>
        </div>
      }
    >
      {step === 1 && (
        <>
          <FieldRecordLabel n={`DAY ${day} · SKIN`} />
          <h2 className="font-serif text-[22px] text-plum mt-2 mb-6">오늘 피부는 어떤가요?</h2>
          <div className="space-y-4">
            {session.selectedConcerns.map(k => (
              <ScoreCard key={k} label={CONCERN_LABEL[k]} value={concernScores[k] ?? null}
                onChange={v => setConcernScores({ ...concernScores, [k]: v })} />
            ))}
          </div>
          <Section title="앰플 사용">
            <div className="grid grid-cols-2 gap-2">
              <Chip active={ampoule === true} onClick={() => setAmpoule(true)}>사용함</Chip>
              <Chip active={ampoule === false} onClick={() => setAmpoule(false)}>사용하지 않음</Chip>
            </div>
          </Section>
        </>
      )}

      {step === 2 && (
        <SleepStep bedtime={bedtime} wakeTime={wakeTime} setBedtime={setBedtime} setWakeTime={setWakeTime} />
      )}

      {step === 3 && (
        <>
          <FieldRecordLabel n={`DAY ${day} · MOOD`} />
          <h2 className="font-serif text-[22px] text-plum mt-2">오늘은 어떤 하루였나요?</h2>
          <p className="text-[13px] text-charcoal/60 mt-2 mb-5">지금 마음과 가까운 단어를 최대 2개 골라주세요.</p>
          <div className="flex flex-wrap gap-2">
            {EMOTION_KEYS.map(k => {
              const active = emotions.includes(k);
              const score = EMOTION_SCORE[k];
              const tone = score === 0 ? "text-moss border-moss/40 bg-moss/8" : score === 1 ? "text-lilac border-lilac/40 bg-lilac/8" : "text-rose border-rose/50 bg-rose/10";
              const activeTone = score === 0 ? "bg-moss/25 border-moss text-plum" : score === 1 ? "bg-lilac/25 border-lilac text-plum" : "bg-rose/30 border-rose text-plum";
              return (
                <button key={k} onClick={() => {
                  if (active) setEmotions(emotions.filter(x => x !== k));
                  else if (emotions.length >= 2) showToast("최대 2개까지 선택할 수 있어요.");
                  else setEmotions([...emotions, k]);
                }}
                  className={`min-h-[44px] px-4 rounded-full border text-[13px] font-medium transition ${active ? activeTone : tone}`}>
                  {active && <span className="mr-1">✓</span>}{EMOTION_LABEL[k]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-6">최소 1개, 최대 2개 · {emotions.length}/2</p>
        </>
      )}

      {step === 4 && (
        <>
          <FieldRecordLabel n={`DAY ${day} · MOVEMENT`} />
          <h2 className="font-serif text-[22px] text-plum mt-2 mb-5">오늘 몸을 움직였나요?</h2>
          <div className="grid grid-cols-2 gap-2">
            {EXERCISE_KEYS.map(k => (
              <button key={k} onClick={() => setExercise(k)}
                className={`relative min-h-[76px] rounded-xl border p-3 text-left text-[13px] font-medium transition ${
                  exercise === k ? "bg-forest/12 border-forest text-plum" : "bg-card border-border text-charcoal/75"
                }`}>
                <ExerciseIcon k={k} className="mb-1.5 opacity-80" />
                {EXERCISE_LABEL[k]}
                {exercise === k && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-forest text-ivory grid place-items-center text-[11px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <FieldRecordLabel n={`DAY ${day} · CONTEXT`} />
          <h2 className="font-serif text-[22px] text-plum mt-2 mb-5">피부에 영향을 줄 만한 일이 있었나요?</h2>
          <div className="grid grid-cols-2 gap-2">
            {CONTEXT_KEYS.filter(k => k !== "menstrual" || session.showMenstrualFactor).map(k => {
              const active = context.includes(k);
              return (
                <button key={k} onClick={() => {
                  if (k === "none") { setContext(active ? [] : ["none"]); return; }
                  if (active) setContext(context.filter(x => x !== k));
                  else setContext([...context.filter(x => x !== "none"), k]);
                }}
                  className={`relative min-h-[68px] rounded-xl border p-3 text-left text-[13px] font-medium ${
                    active ? contextActiveClass(k) : "bg-card border-border text-charcoal/75"
                  }`}>
                  <div className="w-2 h-2 rounded-full mb-1.5" style={{ background: contextDot(k) }} />
                  {CONTEXT_LABEL[k]}
                  {active && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-plum text-ivory grid place-items-center text-[11px]">✓</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-6">해당 없음을 선택하면 다른 선택이 해제돼요.</p>
        </>
      )}
    </Screen>
  );
}

function ExerciseIcon({ k, className = "" }: { k: ExerciseKey; className?: string }) {
  const stroke = "#24152B";
  const p = "M";
  void p;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className}>
      {k === "gym" && <><rect x="2" y="9" width="3" height="6" rx="1" stroke={stroke}/><rect x="19" y="9" width="3" height="6" rx="1" stroke={stroke}/><path d="M5 12h14" stroke={stroke}/></>}
      {k === "running" && <><circle cx="14" cy="5" r="1.5" stroke={stroke}/><path d="M8 21l3-5 3 2 3-4 4 2M9 12l3-3 3 3" stroke={stroke} strokeLinecap="round"/></>}
      {k === "walking" && <><circle cx="12" cy="4" r="1.5" stroke={stroke}/><path d="M10 22l2-6 3 2 3-6M8 12l3-2 2 3" stroke={stroke} strokeLinecap="round"/></>}
      {k === "yoga" && <><circle cx="12" cy="5" r="1.5" stroke={stroke}/><path d="M6 20c2-3 4-4 6-4s4 1 6 4M8 12c2-1 3-1 4-1s2 0 4 1" stroke={stroke} strokeLinecap="round"/></>}
      {k === "pilates" && <><path d="M4 16c3-2 5-3 8-3s5 1 8 3M4 20h16" stroke={stroke} strokeLinecap="round"/></>}
      {k === "cycling" && <><circle cx="6" cy="17" r="3" stroke={stroke}/><circle cx="18" cy="17" r="3" stroke={stroke}/><path d="M6 17l4-7h5l3 7M13 6h3" stroke={stroke} strokeLinecap="round"/></>}
      {k === "swimming" && <><path d="M2 16c2 1 3-1 5-1s3 2 5 1 3-2 5-1 3 1 5 1M2 20c2 1 3-1 5-1s3 2 5 1 3-2 5-1 3 1 5 1" stroke={stroke} strokeLinecap="round"/><circle cx="8" cy="8" r="1.5" stroke={stroke}/></>}
      {k === "hiking" && <><path d="M3 20l5-10 3 4 3-6 7 12H3z" stroke={stroke} strokeLinejoin="round"/></>}
      {k === "ballsports" && <><circle cx="12" cy="12" r="7" stroke={stroke}/><path d="M5 12h14M12 5v14" stroke={stroke}/></>}
      {k === "none" && <><circle cx="12" cy="12" r="7" stroke={stroke}/><path d="M8 12h8" stroke={stroke} strokeLinecap="round"/></>}
    </svg>
  );
}

function contextDot(k: ContextKey) {
  return {
    longtravel: "#A78BC4", trip: "#C7B3E0", outdoor: "#71876B", alcohol: "#8B3E4A",
    menstrual: "#E7A6B8", mask: "#B7B0A6", newcosmetic: "#C9A84C", latecleanse: "#2E3A5F",
    none: "#B7B0A6",
  }[k];
}
function contextActiveClass(k: ContextKey) {
  const map: Record<ContextKey, string> = {
    longtravel: "bg-lilac/25 border-lilac text-plum",
    trip: "bg-lilac/15 border-lilac text-plum",
    outdoor: "bg-moss/20 border-moss text-plum",
    alcohol: "bg-[#8B3E4A]/15 border-[#8B3E4A] text-plum",
    menstrual: "bg-rose/25 border-rose text-plum",
    mask: "bg-muted border-charcoal/40 text-plum",
    newcosmetic: "bg-[#C9A84C]/20 border-[#C9A84C] text-plum",
    latecleanse: "bg-[#2E3A5F]/15 border-[#2E3A5F] text-plum",
    none: "bg-plum text-ivory border-plum",
  };
  return map[k];
}

/* Sleep step split for clarity */
function SleepStep({ bedtime, wakeTime, setBedtime, setWakeTime }: { bedtime: string; wakeTime: string; setBedtime: (v: string) => void; setWakeTime: (v: string) => void }) {
  const min = sleepMinutesFromTimes(bedtime, wakeTime);
  const h = Math.floor(min / 60);
  const m = min % 60;

  const setByHours = (hours: number) => {
    // Set wake to 07:00, bed accordingly
    const wakeMin = 7 * 60;
    let bedMin = wakeMin - hours * 60;
    if (bedMin < 0) bedMin += 1440;
    const fmt = (v: number) => `${String(Math.floor(v/60)).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`;
    setBedtime(fmt(bedMin));
    setWakeTime(fmt(wakeMin));
  };

  return (
    <>
      <FieldRecordLabel n="SLEEP" />
      <h2 className="font-serif text-[22px] text-plum mt-2 mb-6">어젯밤, 얼마나 쉬었나요?</h2>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] tracking-brand text-muted-foreground">취침</div>
            <div className="tnum text-[26px] font-bold text-plum mt-1" style={{ minWidth: "5ch" }}>{bedtime}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] tracking-brand text-muted-foreground">기상</div>
            <div className="tnum text-[26px] font-bold text-plum mt-1" style={{ minWidth: "5ch" }}>{wakeTime}</div>
          </div>
        </div>
        <div className="mt-4">
          <SleepDial bedtime={bedtime} wakeTime={wakeTime}
            onChange={(b, w) => { setBedtime(b); setWakeTime(w); }} />
        </div>
        <div className="text-center mt-2">
          <div className="text-[11px] tracking-brand text-muted-foreground">총 수면</div>
          <div className="tnum text-[22px] font-bold text-plum" style={{ minWidth: "6ch", display: "inline-block" }}>{h}시간 {m}분</div>
        </div>
      </Card>

      <div className="mt-6">
        <div className="text-[13px] font-medium text-plum mb-2">빠른 선택</div>
        <div className="grid grid-cols-5 gap-2">
          {[5,6,7,8].map(hr => (
            <button key={hr} onClick={() => setByHours(hr)}
              className="min-h-[48px] rounded-xl border border-border bg-card text-[13px] font-medium tnum">
              {hr}시간
            </button>
          ))}
          <button onClick={() => {}} className="min-h-[48px] rounded-xl border border-plum bg-plum text-ivory text-[12px]">직접</button>
        </div>
      </div>
    </>
  );
}

/* =============================================================================
   DAY COMPLETE
============================================================================= */
function DayComplete({ session, onContinue }: { session: RecoverySession; onContinue: () => void }) {
  const last = session.dailyLogs[session.dailyLogs.length - 1];
  const done = session.dailyLogs.length;
  const day = Math.min(done, 7);
  // Compare each concern to baseline
  const changes = session.selectedConcerns.map(k => {
    const base = session.baselineScores[k] ?? 0;
    const cur = last?.concernScores[k];
    if (typeof cur !== "number") return null;
    const diff = base - cur;
    if (diff > 0) return `${CONCERN_LABEL[k]} 점수가 시작일보다 ${diff}점 낮게 기록됐어요.`;
    if (diff < 0) return `${CONCERN_LABEL[k]} 점수가 시작일보다 ${-diff}점 높게 기록됐어요.`;
    return `${CONCERN_LABEL[k]} 점수는 시작일과 같았어요.`;
  }).filter(Boolean) as string[];

  const emotionLine = last?.emotions.length
    ? `오늘은 ${last.emotions.map(e => EMOTION_LABEL[e]).join("·")}${last.contextFactors.filter(c => c !== "none").length ? " · " + last.contextFactors.filter(c => c !== "none").map(c => CONTEXT_LABEL[c]).join("·") : ""}이(가) 함께 기록됐어요.`
    : null;

  return (
    <Screen
      footer={<PrimaryButton onClick={onContinue}>{session.completed ? "리포트 확인하기" : "진행 현황으로"}</PrimaryButton>}
    >
      <div className="pt-8 text-center">
        <BloomFlower day={day} size={180} />
        <div className="text-[11px] tracking-brand text-muted-foreground uppercase mt-4">DAY {day} · COMPLETE</div>
        <h2 className="font-serif text-[26px] text-plum mt-2">오늘 기록 완료</h2>
        <p className="text-[13px] text-muted-foreground mt-1">지금까지 {done}일을 기록했어요.</p>
        {!session.completed && <p className="text-[13px] text-charcoal/70 mt-1">개화까지 {7 - done}일 남았어요.</p>}
      </div>

      <div className="mt-8 space-y-2">
        {changes.map((t, i) => (
          <Card key={i}><div className="text-[13px] leading-[1.6] text-plum">{t}</div></Card>
        ))}
        {emotionLine && <Card><div className="text-[13px] leading-[1.6] text-charcoal/75">{emotionLine}</div></Card>}
      </div>
    </Screen>
  );
}

/* =============================================================================
   REPORT
============================================================================= */
function Report({ session, demoMode, onBack, onReset }: { session: RecoverySession; demoMode: boolean; onBack: () => void; onReset: () => void }) {
  const results = useMemo(() => concernResults(session), [session]);
  const avg = useMemo(() => averageImprovement(session), [session]);
  const usage = useMemo(() => ampouleUsageRate(session), [session]);
  const compl = useMemo(() => completionRate(session), [session]);
  const factors = useMemo(() => lifestyleFactors(session), [session]);
  const rtype = useMemo(() => recoveryType(session, factors), [session, factors]);
  const suggestion = useMemo(() => nextWeekSuggestion(factors), [factors]);

  const topImprove = [...results].sort((a, b) => (b.improvement ?? -1) - (a.improvement ?? -1))[0];
  const sortedResults = [...results].sort((a, b) => (b.improvement ?? b.delta) - (a.improvement ?? a.delta));

  return (
    <div className="min-h-full">
      <TopBar subtitle={demoMode ? "DEMO REPORT" : "FINAL REPORT"} title="7-Day Bloom Report" onBack={onBack} />

      <main className="px-5 pb-16 pt-2 space-y-5">
        {/* HERO */}
        <div className="print-avoid-break bg-plum text-ivory rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 opacity-90">
            <BloomFlower day={7} size={180} />
          </div>
          <div className="text-[10px] tracking-brand text-ivory/60 uppercase">RECOVERY REPORT · N°{session.id.slice(0,6).toUpperCase()}</div>
          <div className="font-serif tracking-[0.3em] text-[16px] text-ivory/85 mt-1">SOLVÉRA</div>
          <div className="mt-6">
            <div className="text-[11px] tracking-brand text-ivory/60 uppercase">평균 개선</div>
            <div className="tnum font-bold leading-none text-ivory mt-2" style={{ fontSize: 56 }}>
              {avg !== null ? `${avg}%` : "–"}
            </div>
            <p className="mt-4 font-serif text-[17px] leading-[1.5] text-ivory/95 max-w-[220px]">
              {avg !== null
                ? `SOLVÉRA 리커버리 앰플과 함께한 7일 동안 주요 피부 고민이 평균 ${avg}% 개선되었어요.`
                : "7일 동안의 기록이 완료됐어요."}
            </p>
            <p className="text-[10px] text-ivory/50 mt-2">사용자가 직접 기록한 점수 기준</p>
          </div>
        </div>

        {/* Small cards */}
        <div className="grid grid-cols-2 gap-3 print-avoid-break">
          <Card className="min-h-[110px]">
            <div className="text-[11px] tracking-brand text-muted-foreground uppercase">최대 개선</div>
            <div className="mt-2 font-serif text-[17px] text-plum leading-tight break-keep">{topImprove?.label ?? "–"}</div>
            <div className="tnum font-bold text-plum mt-1" style={{ fontSize: 24 }}>
              {topImprove?.improvement !== null && topImprove?.improvement !== undefined ? `${topImprove.improvement}%` : `-${topImprove?.delta ?? 0}pt`}
            </div>
          </Card>
          <Card className="min-h-[110px]">
            <div className="text-[11px] tracking-brand text-muted-foreground uppercase">앰플 사용률</div>
            <div className="tnum font-bold text-plum mt-2" style={{ fontSize: 32 }}>{usage}%</div>
            <div className="text-[11px] text-muted-foreground mt-1 tnum">기록 {session.dailyLogs.length}일 기준</div>
          </Card>
        </div>

        <div className="flex justify-between text-[11px] text-muted-foreground px-1 tnum print-avoid-break">
          <span>완료율 {compl}%</span>
          <span>기록 {session.dailyLogs.length}일</span>
          <span>선택 고민 {session.selectedConcerns.length}개</span>
        </div>

        {/* Concern change cards */}
        <section className="space-y-3">
          <SectionTitle n="CONCERN CHANGE" title="고민별 변화" />
          {sortedResults.map((r, i) => (
            <Card key={r.key} className="print-avoid-break">
              <div className="flex items-baseline justify-between">
                <div className="font-serif text-[17px] text-plum">{r.label}</div>
                <div className="tnum font-bold text-plum text-[22px]">
                  {r.improvement !== null ? `${r.improvement}%` : `-${r.delta}pt`}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="tnum text-[13px] text-muted-foreground">{r.start}점 → {r.end}점</div>
                <div className="flex-1"><Sparkline data={r.series} /></div>
              </div>
              <div className="text-[12px] text-charcoal/70 mt-2 leading-[1.6]">
                {i === 0 && (r.improvement ?? 0) > 0 && "이번 기록에서 가장 큰 변화가 나타났어요."}
                {i > 0 && (r.improvement ?? 0) > 20 && "꾸준히 낮아지는 흐름이 확인됐어요."}
                {i > 0 && (r.improvement ?? 0) > 0 && (r.improvement ?? 0) <= 20 && "완만하게 낮아졌어요."}
                {(r.improvement ?? 0) <= 0 && "점수 변화가 크지 않았어요."}
              </div>
            </Card>
          ))}
        </section>

        {/* Lifestyle factors */}
        <section className="space-y-3">
          <SectionTitle n="LIFESTYLE FACTORS" title="피부에 영향을 준 요인" />
          {factors.length === 0
            ? <Card><div className="text-[13px] text-charcoal/70 leading-[1.6]">뚜렷한 생활 요인 차이가 관찰되지 않았어요. 다음 7일도 기록을 이어가면 패턴이 더 명확해져요.</div></Card>
            : factors.map((f, i) => (
                <Card key={f.key} className="print-avoid-break">
                  <div className="flex items-baseline justify-between">
                    <div className="font-serif text-[17px] text-plum">{i+1}. {f.label}</div>
                    <div className={`tnum font-bold text-[18px] ${f.diff > 0 ? "text-destructive" : "text-moss"}`}>
                      {f.diff > 0 ? "+" : ""}{f.diff.toFixed(1)}pt
                    </div>
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1 tnum">있었던 날 {f.withAvg.toFixed(1)}점 · 없었던 날 {f.withoutAvg.toFixed(1)}점</div>
                  <div className="text-[12px] text-charcoal/70 mt-2 leading-[1.6]">
                    {f.diff > 0
                      ? `${f.label}이(가) 있었던 날 피부 불편 점수가 다른 날보다 평균 ${f.diff.toFixed(1)}점 높게 기록됐어요.`
                      : `${f.label}이(가) 있었던 날 피부 컨디션이 다른 날보다 안정적이었어요.`}
                  </div>
                </Card>
              ))
          }
        </section>

        {/* Emotional summary — 자유 입력 기반, 정형 데이터와 분리 */}
        {session.dailyLogs.some(l => l.note || l.noteKeyword) && (
          <section className="space-y-3">
            <SectionTitle n="EMOTIONAL SUMMARY" title="감성 요약" />
            <Card className="print-avoid-break">
              <div className="text-[13px] text-charcoal/75 leading-[1.7]">
                이번 주 가장 자주 등장한 키워드는{" "}
                <b className="text-plum">#{topKeyword(session.dailyLogs.map(l => l.noteKeyword).filter(Boolean) as string[])}</b> 였어요.
              </div>
              <div className="mt-3 space-y-2">
                {session.dailyLogs.filter(l => l.note).map(l => (
                  <div key={l.day} className="rounded-xl border border-border bg-secondary/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] tracking-brand text-muted-foreground">DAY {l.day}</span>
                      {l.noteKeyword && <span className="text-[11px] font-semibold text-rose bg-rose/15 px-2 py-0.5 rounded-full">#{l.noteKeyword}</span>}
                    </div>
                    <p className="text-[13px] text-charcoal/80 mt-1.5 leading-[1.6]">{l.note}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                이 요약은 자유 입력 기록에서만 도출되며, 위의 상관관계 리포트(정형 태그)에는 반영되지 않습니다.
              </p>
            </Card>
          </section>
        )}

        {/* Recovery type */}
        <section className="space-y-3">
          <SectionTitle n="RECOVERY TYPE" title="이번 7일의 리커버리 유형" />
          <Card className="print-avoid-break bg-[color-mix(in_oklab,var(--lilac)_16%,var(--card))]">
            <div className="text-[11px] tracking-brand text-plum/60 uppercase">YOUR TYPE</div>
            <div className="font-serif text-[22px] text-plum mt-1">{rtype.label}</div>
            <p className="text-[13px] text-charcoal/75 mt-3 leading-[1.7]">{rtype.desc}</p>
            <p className="text-[10px] text-muted-foreground mt-3">이번 기록을 바탕으로 분류한 생활 패턴이며 의학적 진단이 아닙니다.</p>
          </Card>
        </section>

        {/* Next 7 days */}
        <section className="space-y-3">
          <SectionTitle n="NEXT 7 DAYS" title="다음 7일 제안" />
          <Card className="print-avoid-break">
            <p className="text-[14px] text-plum leading-[1.7] font-serif">{suggestion}</p>
          </Card>
        </section>

        <div className="pt-4 no-print space-y-3">
          <PrimaryButton onClick={() => window.print()} variant="outline">인쇄 · PDF로 저장</PrimaryButton>
          {!demoMode && <button onClick={onReset} className="mx-auto block text-[12px] text-muted-foreground underline">기록 초기화</button>}
        </div>
      </main>
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="pt-3">
      <div className="text-[10px] tracking-brand text-muted-foreground uppercase">FIELD RECORD · {n}</div>
      <h3 className="font-serif text-[18px] text-plum mt-1">{title}</h3>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 100, h = 28;
  const max = Math.max(...data, 10);
  const min = 0;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8">
      <polyline points={pts} fill="none" stroke="#A78BC4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        return <circle key={i} cx={x} cy={y} r={1.4} fill="#24152B" />;
      })}
    </svg>
  );
}
