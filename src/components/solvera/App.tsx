import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Copy, Info, Instagram, Share2 } from "lucide-react";
import { toast } from "sonner";
import { BloomFlower } from "./BloomFlower";
import { FlowerGarden } from "./FlowerGarden";
import { PlantIdentity } from "./PlantIdentity";
import { ForecastCard } from "./ForecastCard";
import { PeriodCard } from "./PeriodCard";
import { ReminderCard } from "./ReminderCard";
import { TodayCard } from "./TodayCard";
import { CycleCard } from "./CycleCard";
import { startExperiment } from "@/lib/solvera/experiment";
import { SkinTipScene } from "./SkinTipScene";
import { SleepDial } from "./SleepDial";
import { ChatDailyFlow } from "./ChatDailyFlow";
import {
  CONCERN_KEYS, CONCERN_LABEL, EMOTION_KEYS, EMOTION_LABEL, EMOTION_SCORE,
  EXERCISE_KEYS, EXERCISE_LABEL, EXERCISE_META, CONTEXT_KEYS, CONTEXT_LABEL,
  type ConcernKey, type EmotionKey, type ExerciseKey, type ContextKey,
  type RecoverySession, type SkinType, type CurrentCondition, type DailyLog, type Experiment,
} from "@/lib/solvera/types";
import { loadSession, saveSession, clearSession, todayISO } from "@/lib/solvera/storage";
import { startNextCycle } from "@/lib/solvera/cycle";
import { trackEvent } from "@/lib/solvera/analytics";
import { QUICK_LEVELS, QUICK_LEVEL_TO_SCORE, addQuickCheck, loadQuick, loadQuickPlant, quickStreak, saveQuick, saveQuickPlant, type QuickCheck, type QuickLevel, type QuickPlant } from "@/lib/solvera/quick";
import { MAX_PLANT_NAME_LENGTH } from "@/lib/solvera/plantShare";
import { REGIONS, attachWeatherToSession, fetchDailyWeather, isRegionKey, pastDaysNeeded } from "@/lib/solvera/weather";
import { fetchPopulationPriors, grantConsent, syncLogs, withdrawConsent } from "@/lib/solvera/cloud";
import type { Prior } from "@/lib/solvera/estimate";
import { buildDemoSession } from "@/lib/solvera/demo";
import { CONCERN_EXAMPLES, SCORE_BANDS, scoreBandIndex } from "@/lib/solvera/scale";
import { completedChallengeLogs, currentStreak, hasCompletedChallenge } from "@/lib/solvera/streak";
import { GROWTH_STAGES, MAX_GROWTH_XP, growthProgress } from "@/lib/solvera/growth";
import { topKeyword } from "@/lib/solvera/keyword";
import {
  concernResults, dailyDiscomfort, ampouleUsageRate, completionRate,
  lifestyleFactors, recoveryType, sleepMinutesFromTimes, sleepCategoryFrom,
  dailyInsight, reportEvidence, overallChange, bestAndWorstDays, changeHeadline, nextAction,
} from "@/lib/solvera/analysis";

type Phase =
  | "landing" | "consent" | "profile" | "concerns" | "baseline" | "dashboard"
  | "daily" | "chat-daily" | "day-complete" | "report" | "quick";

export function SolveraApp() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [session, setSession] = useState<RecoverySession | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [priors, setPriors] = useState<Record<string, Prior>>({});

  useEffect(() => {
    const s = loadSession();
    if (s) setSession(s);
  }, []);

  useEffect(() => {
    if (session && !demoMode) saveSession(session);
  }, [session, demoMode]);

  // 별도로 동의한 경우에만 기록을 서버에 올린다. 실패해도 앱 사용에는 영향이 없다(기기 저장이 기준).
  const logCount = session?.dailyLogs.length ?? 0;
  const consented = !!session?.cloudConsent;
  useEffect(() => {
    if (!session || demoMode || !consented || !logCount) return;
    syncLogs(session).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logCount, consented, demoMode]);

  useEffect(() => {
    fetchPopulationPriors().then(setPriors);
    trackEvent("app_open");
  }, []);

  // 사는 지역을 고른 경우, 날씨가 비어 있는 기록에 그날의 자외선·습도·기온·미세먼지를 붙인다.
  const region = session?.region;
  useEffect(() => {
    if (!session || demoMode || !isRegionKey(region)) return;
    const need = pastDaysNeeded(session, todayISO());
    if (need === null) return;
    let cancelled = false;
    fetchDailyWeather(region, need).then(byDate => {
      if (!cancelled && Object.keys(byDate).length) setSession(prev => (prev ? attachWeatherToSession(prev, byDate) : prev));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logCount, region, demoMode]);

  // 기록을 새로 저장할 때마다 센다(주간 활성 기록률). 처음 불러올 때의 기존 기록 수는 세지 않는다.
  const hasSession = !!session;
  const prevLogCount = useRef<number | null>(null);
  useEffect(() => {
    if (!hasSession || demoMode) return;
    if (prevLogCount.current !== null && logCount > prevLogCount.current) trackEvent("log_saved");
    prevLogCount.current = logCount;
  }, [logCount, hasSession, demoMode]);

  const completed = !!session?.completed;
  useEffect(() => {
    if (demoMode) return;
    if (logCount >= 1) trackEvent("first_log");
    if (completed) trackEvent("challenge_complete");
  }, [logCount, completed, demoMode]);

  const withdrawCloud = async () => {
    if (!session) return;
    if (!confirm("서버에 보낸 기록을 모두 삭제하고 동의를 철회할까요? 이 기기의 기록은 그대로 남아요.")) return;
    try {
      await withdrawConsent();
      setSession({ ...session, cloudConsent: false });
    } catch {
      alert("철회하지 못했어요. 잠시 뒤 다시 시도해주세요.");
    }
  };

  const startFresh = () => {
    const s: RecoverySession = {
      version: 1, id: crypto.randomUUID(), startedAt: new Date().toISOString(), plantName: loadQuickPlant()?.name ?? "나의 찔레꽃",
      skinType: "unknown", sensitivity: 3, currentCondition: "same",
      showMenstrualFactor: false, selectedConcerns: ["trouble"], baselineScores: {}, profileDone: false,
      dailyLogs: [], wateredDates: [], fertilizedDates: [], completed: false,
    };
    setSession(s); setDemoMode(false); setPhase("consent");
  };

  const resumeSession = () => {
    if (!session) return;
    if (session.completed) setPhase("report");
    else if (!session.selectedConcerns.length) setPhase("concerns");
    else if (!Object.keys(session.baselineScores).length) setPhase("baseline");
    else setPhase("dashboard");
  };

  const showDemo = () => {
    setSession(buildDemoSession()); setDemoMode(true); setPhase("report");
  };

  const continueNextCycle = (experiment?: Experiment) => {
    if (!session) return;
    trackEvent("next_cycle_start");
    if (experiment) trackEvent("experiment_start");
    const next = startNextCycle(session);
    setSession(experiment ? { ...next, experiment } : next); setPhase("dashboard");
  };

  const resetAll = () => {
    if (!confirm(session?.cloudConsent ? "이 기기의 기록과 서버에 보낸 기록을 모두 삭제하고 동의도 철회할까요? 되돌릴 수 없습니다." : "모든 기록을 초기화하시겠어요? 되돌릴 수 없습니다.")) return;
    if (session?.cloudConsent) withdrawConsent().catch(() => {});
    clearSession(); setSession(null); setDemoMode(false); setPhase("landing");
  };

  return (
    <div className="min-h-full text-charcoal font-sans">
      {phase === "landing" && <Landing hasSession={!!session} onStart={startFresh} onResume={resumeSession} onDemo={showDemo} onQuick={() => setPhase("quick")} />}
      {phase === "quick" && <QuickRitual onFull={() => { trackEvent("quick_to_full"); startFresh(); }} onBack={() => setPhase("landing")} />}
      {phase === "consent" && session && <Consent onBack={() => setPhase("landing")} onNext={async (cloud: boolean) => {
        let granted = false;
        if (cloud) { try { await grantConsent(); granted = true; } catch { /* 동의 저장에 실패하면 서버 전송 없이 기기에만 저장 */ } }
        if (cloud && !granted) toast("지금은 서버 저장을 쓸 수 없어서 이 기기에만 저장해요.");
        setSession({ ...session, cloudConsent: granted }); setPhase("concerns");
      }} />}
      {phase === "profile" && session && <Profile session={session} setSession={setSession} onNext={() => { setSession({ ...session, profileDone: true }); setPhase("dashboard"); }} onBack={() => setPhase("dashboard")} />}
      {phase === "concerns" && session && <ConcernsPick session={session} setSession={setSession} onNext={() => setPhase("baseline")} onBack={() => setPhase("consent")} />}
      {phase === "baseline" && session && <Baseline session={session} setSession={setSession} onNext={() => setPhase("dashboard")} onBack={() => setPhase("concerns")} />}
      {phase === "dashboard" && session && <Dashboard session={session} setSession={setSession} onDaily={() => setPhase("daily")} onChatDaily={() => setPhase("chat-daily")} onReport={() => setPhase("report")} onReset={resetAll} onProfile={() => setPhase("profile")} />}
      {phase === "chat-daily" && session && <ChatDailyFlow session={session} setSession={setSession} onDone={() => setPhase("day-complete")} onCancel={() => setPhase("dashboard")} />}
      {phase === "daily" && session && <DailyFlow session={session} setSession={setSession} onDone={() => setPhase("day-complete")} onCancel={() => setPhase("dashboard")} />}
      {phase === "day-complete" && session && <DayComplete session={session} setSession={setSession} onContinue={() => setPhase(session.completed ? "report" : "dashboard")} />}
      {phase === "report" && session && <Report session={demoMode ? session : { ...session, dailyLogs: completedChallengeLogs(session.dailyLogs) }} demoMode={demoMode} onBack={() => demoMode ? setPhase("landing") : setPhase("dashboard")} onReset={resetAll} onNext={continueNextCycle} priors={priors} onWithdraw={withdrawCloud} />}
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
      <main className="flex-1 px-5 pb-8 pt-5">{children}</main>
      {footer && (
        <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] bg-white/15 backdrop-blur-md no-print">
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
        <button onClick={onBack} className="h-11 w-11 -ml-2 rounded-full flex items-center justify-center text-charcoal/70 hover:bg-white/40 glass-pill" aria-label="뒤로">
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
  const base = "w-full min-h-[52px] rounded-full px-5 font-bold text-[13px] tracking-[0.08em] uppercase transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100";
  const style = variant === "primary"
    ? "glass-lucky hover:bg-white/45"
    : variant === "outline"
      ? "glass-lucky hover:bg-white/45"
      : "bg-transparent text-plum/75 hover:text-plum";
  return (
    <button className={`${base} ${style}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-surface rounded-[28px] p-4 ${className}`}>
      {children}
    </div>
  );
}

function FieldRecordLabel({ n }: { n: string }) {
  return <div className="text-[10px] tracking-brand text-muted-foreground uppercase">FIELD RECORD · {n}</div>;
}

function waterToday(session: RecoverySession, setSession: (session: RecoverySession) => void) {
  const date = todayISO();
  if (!growthProgress(session, date).canWater) return;
  setSession({ ...session, wateredDates: [...session.wateredDates, date] });
}

function fertilizeToday(session: RecoverySession, setSession: (session: RecoverySession) => void) {
  const date = todayISO();
  if (!growthProgress(session, date).canFertilize) return;
  setSession({ ...session, fertilizedDates: [...session.fertilizedDates, date] });
}

function GrowthMeter({ session }: { session: RecoverySession }) {
  const { day, xp, canWater, wateredToday, canFertilize, fertilizedToday } = growthProgress(session, todayISO());
  const status = fertilizedToday ? "영양을 머금고 있어요" : canFertilize ? "비료를 줄 수 있어요" : wateredToday ? "촉촉하게 자라는 중" : canWater ? "물이 필요해요" : day === 0 ? "오늘의 첫 기록을 기다려요" : day === 7 ? "찔레꽃이 피었어요" : "다음 기록을 기다려요";
  return (
    <div className="mx-auto w-full max-w-[340px]" aria-live="polite">
      <div className="flex items-end justify-between gap-2">
        <div><div className="text-[10px] tracking-brand text-charcoal/50">내 꽃의 상태</div><div className="mt-1 font-serif text-[17px] text-plum">{GROWTH_STAGES[day]} · {status}</div></div>
        <div className="shrink-0 text-right"><span className="tnum text-[19px] font-bold text-forest">{xp}</span><span className="text-[11px] text-charcoal/50"> / {MAX_GROWTH_XP} XP</span></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/55" role="progressbar" aria-label="꽃 성장 경험치" aria-valuenow={xp} aria-valuemin={0} aria-valuemax={MAX_GROWTH_XP}>
        <div className="h-full rounded-full bg-[#6d9f76] transition-[width] duration-700" style={{ width: `${(xp / MAX_GROWTH_XP) * 100}%` }} />
      </div>
      <div className="mt-2 text-[11px] text-charcoal/55">기록 +80 · 물 +20 · 비료 +30 XP (2·4·6일차)</div>
    </div>
  );
}

/* =============================================================================
   LANDING
============================================================================= */
function Landing({ hasSession, onStart, onResume, onDemo, onQuick }: { hasSession: boolean; onStart: () => void; onResume: () => void; onDemo: () => void; onQuick: () => void }) {
  return (
    <Screen>
      <div className="flex flex-col items-center text-center pt-7">
        <div className="glass-pill px-4 py-2 text-[10px] tracking-brand text-plum/60 uppercase">RECOVERY RECORD · N°001</div>
        <div className="mt-3 font-serif tracking-[0.3em] text-[22px] font-bold text-plum">SOOPSAI</div>
        <h1 className="mt-8 font-serif text-[28px] leading-[1.3] text-plum drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]">
          내 피부가 왜 이런지<br/>몰라서 답답했다면
        </h1>
        <p className="mt-3 text-[13px] leading-[1.6] text-charcoal/70">매일 한 번만 눌러도, 내 패턴이 보이기 시작해요.</p>

        <div className="mt-9 rounded-full bg-white/10 p-2 shadow-[0_24px_54px_-32px_rgba(44,26,83,0.42)]">
          <BloomFlower day={7} size={220} />
        </div>

        <div className="w-full mt-6 space-y-3">
          <PrimaryButton onClick={onQuick}>10초만 해볼게요</PrimaryButton>
          <PrimaryButton onClick={onStart} variant="outline">7일 기록 시작하기</PrimaryButton>
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
   QUICK RITUAL — 가입·동의 없이 한 번 눌러 식물에 물 주기. 이 기기에만 저장한다.
============================================================================= */
type RitualStage = "seed" | "plant" | "water" | "raining" | "wonder" | "born" | "done";
const FRAME_COUNT = 8;

function RitualScene({ stage, frame, onSoil }: { stage: RitualStage; frame: number; onSoil: () => void }) {
  const grown = stage === "wonder" || stage === "born" || stage === "done";
  const wet = stage === "raining" || grown;
  const sprout = stage === "born" || stage === "done" ? FRAME_COUNT - 1 : stage === "wonder" ? frame : 0;
  const label = { seed: "흙 언덕", plant: "씨앗이 흙으로 들어가는 모습", water: "씨앗이 묻힌 흙", raining: "물이 내리는 흙", wonder: "새싹이 올라오는 흙", born: "새로 태어난 새싹", done: "자라는 새싹" }[stage];
  return (
    <div className="ritual-scene relative mx-auto aspect-square w-full max-w-[340px]" role="img" aria-label={label}>
      <div aria-hidden className="ritual-glow absolute inset-[6%] rounded-full" />
      <button type="button" onClick={onSoil} disabled={stage !== "seed"} aria-label="흙에 씨앗 심기" className="absolute inset-0 z-10 cursor-pointer disabled:cursor-default" />
      <img src="/ritual/soil_dry.png" alt="" className={`ritual-fade absolute inset-0 h-full w-full object-contain ${wet ? "opacity-0" : "opacity-100"}`} draggable={false} />
      <img src={`/ritual/sprout_${sprout}.png`} alt="" className={`ritual-fade absolute inset-0 h-full w-full object-contain ${wet ? "opacity-100" : "opacity-0"} ${stage === "wonder" ? "ritual-wiggle" : stage === "born" ? "ritual-pop" : ""}`} draggable={false} />
      {stage === "plant" && <img src="/ritual/seed.png" alt="" className="ritual-seed absolute left-1/2 top-[30%] w-[30%]" draggable={false} />}
      {stage === "raining" && (
        <>
          <img src="/soopsai-watering-can.png" alt="" className="ritual-can absolute -right-1 top-[4%] w-[42%]" draggable={false} />
          {[44, 47, 50, 53, 46, 49, 52, 48].map((left, i) => (
            <span key={i} aria-hidden className="ritual-drop absolute top-[27%] h-4 w-2 rounded-full bg-[#6FB1EC]" style={{ left: `${left}%`, animationDelay: `${(i % 4) * 0.18}s` }} />
          ))}
        </>
      )}
    </div>
  );
}

function QuickRitual({ onFull, onBack }: { onFull: () => void; onBack: () => void }) {
  const [list, setList] = useState<QuickCheck[]>([]);
  const [plant, setPlant] = useState<QuickPlant | null>(null);
  const [stage, setStage] = useState<RitualStage>("seed");
  const [frame, setFrame] = useState(0);
  const [picked, setPicked] = useState<QuickLevel | null>(null);
  const [draft, setDraft] = useState("");
  const today = todayISO();

  useEffect(() => {
    const l = loadQuick();
    const p = loadQuickPlant();
    setList(l); setPlant(p);
    const l0 = l.find(c => c.date === today);
    if (l0) setPicked(l0.level);
    setStage(!p ? "seed" : l0 ? "done" : "water");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage === "plant") { const t = setTimeout(() => setStage("water"), 1300); return () => clearTimeout(t); }
    if (stage === "raining") { const t = setTimeout(() => setStage(plant ? "done" : "wonder"), 1600); return () => clearTimeout(t); }
    if (stage === "wonder") {
      setFrame(0);
      let f = 0;
      const t = setInterval(() => {
        f += 1;
        setFrame(Math.min(f, FRAME_COUNT - 1));
        if (f >= FRAME_COUNT - 1) { clearInterval(t); setTimeout(() => setStage("born"), 450); }
      }, 190);
      return () => clearInterval(t);
    }
  }, [stage, plant]);

  const choose = (level: QuickLevel) => {
    const next = addQuickCheck(list, today, level);
    setList(next); saveQuick(next); setPicked(level);
    trackEvent("quick_check");
    setStage("raining");
  };
  const name = () => {
    const saved = saveQuickPlant({ name: draft, plantedOn: today });
    setPlant(saved);
    setStage("done");
  };

  const streak = Math.max(quickStreak(list, today), picked !== null ? 1 : 0);
  const title: Record<RitualStage, [string, string]> = {
    seed: ["숲사이 어딘가, 흙 속에\n씨앗을 심어볼까요?", "흙을 톡 눌러보세요"],
    plant: ["톡…", "씨앗이 흙 속으로 들어가요"],
    water: plant ? [`${plant.name}에게\n물 줄 시간이에요`, "오늘 피부는 어때요? 하나를 고르면 물이 내려가요"] : ["이제 물이 필요해요", "오늘 피부는 어때요? 하나를 고르면 물이 내려가요"],
    raining: ["촤르르…", "물이 흙에 스며들어요"],
    wonder: ["어…?", "흙이 움직여요"],
    born: ["내 찔레꽃이\n태어났어요!", "이름을 지어주세요"],
    done: [plant ? `${plant.name}\n${streak}일째 자라고 있어요` : "", ""],
  };

  return (
    <Screen header={<TopBar subtitle="10 SECONDS" title="오늘의 물 주기" onBack={onBack} />}>
      <div className="pt-3 text-center">
        <RitualScene stage={stage} frame={frame} onSoil={() => setStage("plant")} />
        <div aria-live="polite">
          <h2 className="mt-4 whitespace-pre-line font-serif text-[24px] leading-[1.3] text-plum">{title[stage][0]}</h2>
          {title[stage][1] && <p className="mt-1 text-[12px] text-charcoal/65">{title[stage][1]}</p>}
        </div>

        {stage === "seed" && <div className="mt-6"><PrimaryButton onClick={() => setStage("plant")}>씨앗 심기</PrimaryButton></div>}
        {stage === "water" && (
          <div className="mt-5 space-y-2">
            {QUICK_LEVELS.map(q => <Chip key={q.level} active={false} onClick={() => choose(q.level)} block>{q.label}</Chip>)}
          </div>
        )}
        {stage === "born" && (
          <form className="mt-5 space-y-3" onSubmit={e => { e.preventDefault(); name(); }}>
            <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} maxLength={MAX_PLANT_NAME_LENGTH} placeholder="나의 찔레꽃" aria-label="식물 이름"
              className="w-full rounded-full border border-white/80 bg-white/60 px-5 py-3 text-center text-[17px] text-plum outline-none focus:border-forest" />
            <PrimaryButton onClick={name}>이름 정하기</PrimaryButton>
          </form>
        )}
        {stage === "done" && picked !== null && (
          <>
            <p className="mt-2 text-[13px] leading-[1.7] text-charcoal/75">{QUICK_LEVELS[picked].reply}</p>
            <div className="mt-6 space-y-2">
              <PrimaryButton onClick={onFull}>내 패턴까지 보러 가기 (1분)</PrimaryButton>
              <PrimaryButton onClick={onBack} variant="ghost">내일 다시 올게요</PrimaryButton>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">정식 기록을 시작하면 수면·감정·날씨까지 함께 비교해드려요. 시작 전에 동의 화면을 거쳐요.</p>
          </>
        )}
      </div>
    </Screen>
  );
}

/* =============================================================================
   CONSENT
============================================================================= */
function Consent({ onBack, onNext }: { onBack: () => void; onNext: (cloud: boolean) => void }) {
  const [ok, setOk] = useState(false);
  const [cloud, setCloud] = useState(false);
  return (
    <Screen
      header={<TopBar subtitle="STEP 01" title="사용 안내" onBack={onBack} />}
      footer={<PrimaryButton onClick={() => onNext(cloud)} disabled={!ok}>동의하고 시작</PrimaryButton>}
    >
      <FieldRecordLabel n="INFO" />
      <h2 className="font-serif text-[24px] leading-tight text-plum mt-2">시작하기 전에</h2>
      <div className="mt-6 space-y-3">
        {[
          ["하루 30초", "매일 한 번 누르면 돼요."],
          ["내 기기에만 저장", "아래 선택에 동의하지 않으면 서버로 보내지 않아요."],
          ["진단이 아니에요", "내 기록을 정리해주는 서비스예요."],
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

      <label className="glass-surface mt-8 flex items-start gap-3 rounded-2xl p-4 cursor-pointer">
        <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-1 h-5 w-5 accent-plum" />
        <span className="text-[13px] leading-[1.5] text-charcoal/80">
          확인했어요.
        </span>
      </label>
      <label className="glass-surface mt-3 flex items-start gap-3 rounded-2xl p-4 cursor-pointer">
        <input type="checkbox" checked={cloud} onChange={e => setCloud(e.target.checked)} className="mt-1 h-5 w-5 accent-plum" />
        <span className="text-[13px] leading-[1.5] text-charcoal/80">
          <b className="text-plum">(선택)</b> 기록을 익명으로 보내 맞춤 분석에 써요. 철회하면 삭제돼요.
          <details className="mt-1.5 text-[11.5px] leading-[1.55] text-charcoal/65">
            <summary className="cursor-pointer font-semibold text-forest">자세히 보기</summary>
            <p className="mt-1">보내는 것: 피부 점수·수면·감정·운동·생활 요인(생리 전·중 표시 포함)이 이름 없이 저장돼요. 자유 입력 메모와 식물 이름은 보내지 않아요. 여러 고객의 기록은 합쳐서 분석 기준을 개선하는 데 쓰이고, 언제든 철회하면 서버 기록이 삭제돼요. 동의하지 않아도 모든 기능을 똑같이 쓸 수 있어요.</p>
          </details>
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
      header={<TopBar subtitle="PROFILE · 선택" title="기본 피부 정보" onBack={onBack} />}
      footer={<PrimaryButton onClick={onNext} disabled={!ready}>저장하고 돌아가기</PrimaryButton>}
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
              className={`flex-1 h-14 rounded-2xl border text-[16px] tnum font-medium transition ${session.sensitivity === n ? "bg-plum text-white border-plum shadow-[0_12px_24px_-18px_rgba(36,21,43,0.7)]" : "glass-pill text-charcoal/70"}`}>
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

      <Section title="사는 지역 (선택)">
        <select value={session.region ?? ""} onChange={e => setSession({ ...session, region: e.target.value || undefined })}
          aria-label="사는 지역" className="w-full rounded-2xl border border-white/80 bg-white/55 px-4 py-3 text-[15px] text-plum">
          <option value="">선택 안 함</option>
          {Object.entries(REGIONS).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
        </select>
        <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground">고르면 그날의 자외선·습도·기온·미세먼지를 기록에 붙여 패턴을 비교해요. 정확한 위치는 쓰지 않고, 고른 시·도의 대표 도시 좌표만 날씨 서비스(Open-Meteo)에 보내요.</p>
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
        active ? "bg-plum text-white border-plum shadow-[0_12px_24px_-18px_rgba(36,21,43,0.7)]" : "glass-pill text-charcoal/75"
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
      header={<TopBar subtitle="STEP 02" title="주요 피부 고민" onBack={onBack} />}
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
              session.selectedConcerns.includes(k) ? "bg-rose/25 border-rose text-plum shadow-[0_12px_24px_-20px_rgba(231,166,184,0.85)]" : "glass-pill text-charcoal/75"
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
  const [seeded, setSeeded] = useState(false);
  // 10초 의식에서 오늘 고른 값이 있으면 트러블 시작 점수를 제안값으로 미리 채운다(바꿀 수 있다).
  useEffect(() => {
    if (!session.selectedConcerns.includes("trouble") || typeof scores.trouble === "number") return;
    const latest = loadQuick().at(-1);
    if (!latest) return;
    setSession({ ...session, baselineScores: { ...scores, trouble: QUICK_LEVEL_TO_SCORE[latest.level] } });
    setSeeded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ready = session.selectedConcerns.length > 0 && session.selectedConcerns.every(k => typeof scores[k] === "number");
  const finishBaseline = () => onNext();
  return (
    <Screen
      header={<TopBar subtitle="STEP 03" title="시작 점수" onBack={onBack} />}
      footer={<PrimaryButton onClick={finishBaseline} disabled={!ready}>기록 시작하기</PrimaryButton>}
    >
      <FieldRecordLabel n="BASELINE" />
      <h2 className="font-serif text-[22px] text-plum mt-2 mb-2">지금의 불편 정도를 알려주세요</h2>
      <p className="text-[13px] text-charcoal/60 mb-6">0은 불편 없음, 10은 매우 불편함이에요. 슬라이더를 움직여 직접 정해주세요.</p>
      {seeded && <p className="mb-4 text-[12px] text-forest">10초 의식에서 고른 값으로 트러블을 미리 채웠어요. 다르면 바꿔주세요.</p>}

      <div className="space-y-4">
        {session.selectedConcerns.map(k => (
          <MoodScoreCard key={k} concern={k} value={scores[k] ?? null} onChange={v => setScore(k, v)} />
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

function MoodScoreCard({ concern, value, onChange }: { concern: ConcernKey; value: number | null; onChange: (v: number) => void }) {
  const v = value ?? 5;
  const mood = discomfortMood(v);
  const [showGuide, setShowGuide] = useState(false);
  const band = scoreBandIndex(v);
  return (
    <div
      className="glass-surface rounded-[28px] p-4 transition-colors duration-300"
      style={{ borderColor: mood.border, background: mood.background }}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[14px] font-medium text-plum">{CONCERN_LABEL[concern]}</div>
          <div
            className="mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: mood.color, background: mood.badge }}
          >
            {mood.label}
          </div>
        </div>
        <div className="tnum text-[28px] font-bold" style={{ color: mood.color }}>
          {v}<span className="text-[13px] text-muted-foreground font-normal">/10</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={v}
        onChange={e => onChange(Number(e.target.value))}
        className="brand-slider mt-3"
        style={{
          "--slider-accent": mood.color,
          "--slider-soft": mood.soft,
          "--slider-progress": `${v * 10}%`,
        } as CSSProperties}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 mt-0.5">
        <span>0</span><span>5</span><span>10</span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-2 text-[12px] leading-5" style={{ color: mood.color }}>
        <span>{SCORE_BANDS[band]}점 · {CONCERN_EXAMPLES[concern][band]}</span>
        <button type="button" onClick={() => setShowGuide(!showGuide)} aria-expanded={showGuide}
          aria-label={`${CONCERN_LABEL[concern]} 점수 기준 ${showGuide ? "닫기" : "보기"}`}
          title="점수 기준 보기" className="shrink-0 rounded-full p-1 hover:bg-white/40">
          <Info size={17} aria-hidden="true" />
        </button>
      </div>
      {showGuide && <div className="mt-2 space-y-1.5 border-t border-white/60 pt-3">
        {CONCERN_EXAMPLES[concern].map((example, index) => (
          <div key={index} className={`flex gap-2 text-[11px] leading-5 ${index === band ? "font-semibold text-plum" : "text-charcoal/65"}`}>
            <span className="w-9 shrink-0 tnum">{SCORE_BANDS[index]}</span><span>{example}</span>
          </div>
        ))}
      </div>}
    </div>
  );
}

function discomfortMood(v: number) {
  if (v <= 1) return {
    label: "거의 불편 없음",
    color: "#5F9F7A",
    soft: "rgba(95,159,122,0.28)",
    badge: "rgba(95,159,122,0.14)",
    border: "rgba(255,255,255,0.86)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08)), rgba(220,248,233,0.36)",
  };
  if (v <= 3) return {
    label: "살짝 신경 쓰임",
    color: "#7FA765",
    soft: "rgba(127,167,101,0.3)",
    badge: "rgba(127,167,101,0.15)",
    border: "rgba(255,255,255,0.86)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08)), rgba(232,246,206,0.38)",
  };
  if (v <= 5) return {
    label: "보통 정도",
    color: "#A08A4D",
    soft: "rgba(160,138,77,0.28)",
    badge: "rgba(160,138,77,0.15)",
    border: "rgba(255,255,255,0.88)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08)), rgba(249,232,181,0.34)",
  };
  if (v <= 7) return {
    label: "꽤 불편함",
    color: "#C1787B",
    soft: "rgba(193,120,123,0.3)",
    badge: "rgba(193,120,123,0.15)",
    border: "rgba(255,255,255,0.9)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08)), rgba(250,210,216,0.34)",
  };
  return {
    label: "많이 불편함",
    color: "#B45B74",
    soft: "rgba(180,91,116,0.32)",
    badge: "rgba(180,91,116,0.16)",
    border: "rgba(255,255,255,0.94)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.08)), rgba(242,188,213,0.36)",
  };
}

/* =============================================================================
   DASHBOARD
============================================================================= */
function Dashboard({ session, setSession, onDaily, onChatDaily, onReport, onReset, onProfile }: { session: RecoverySession; setSession: (s: RecoverySession) => void; onDaily: () => void; onChatDaily: () => void; onReport: () => void; onReset: () => void; onProfile: () => void }) {
  const growth = growthProgress(session, todayISO());
  const done = growth.day;
  const day = Math.min(done + 1, 7);
  const canDaily = !session.completed;
  const canReport = session.completed;
  const todayLogged = session.dailyLogs.some(l => l.date === todayISO());

  return (
    <Screen
      header={<TopBar subtitle={`DAY ${day} / 7`} title="리커버리 진행" />}
    >
      <FieldRecordLabel n="DASHBOARD" />
      <div className="mt-3 text-center">
        <div className="font-serif text-[26px] text-plum leading-tight">DAY {day}</div>
        <div className="text-[13px] text-muted-foreground mt-1">{done === 7 ? "오늘의 찔레꽃이 피었어요" : `개화까지 ${7 - done}일 남았어요`}</div>
      </div>
      <FlowerGarden day={done} canWater={growth.canWater} wateredToday={growth.wateredToday} canFertilize={growth.canFertilize} fertilizedToday={growth.fertilizedToday} onWater={() => waterToday(session, setSession)} onFertilize={() => fertilizeToday(session, setSession)} />
      <GrowthMeter session={session} />
      <PlantIdentity session={session} onNameChange={plantName => setSession({ ...session, plantName })} />

      <Card className="mt-6">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-2">
          <span>기록한 날</span><span className="tnum">{done}/7</span>
        </div>
        <div className="h-2 rounded-full bg-white/45 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="h-full transition-all" style={{ width: `${(done/7)*100}%`, background: "linear-gradient(90deg, var(--rose), var(--lilac), var(--sky))" }} />
        </div>
        <div className="grid grid-cols-7 gap-1.5 mt-4">
          {Array.from({length: 7}).map((_, i) => {
            const n = i + 1;
            const isDone = n <= done;
            const isCurrent = n === day && !isDone;
            return (
              <div key={n} className={`aspect-square rounded-[20px] flex flex-col items-center justify-center border-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-sm ${
                isDone ? "bg-white/45 text-plum border-white" :
                isCurrent ? "bg-white/35 border-white text-plum" :
                "bg-white/20 border-white/60 text-charcoal/40"
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
          todayLogged
            ? <div className="text-center text-[13px] text-muted-foreground py-3">오늘 기록을 완료했어요. 내일 다시 만나요.</div>
            : (
              <>
                <PrimaryButton onClick={onChatDaily}>대화형으로 기록하기</PrimaryButton>
                <PrimaryButton onClick={onDaily} variant="outline">기존 단계별로 기록하기</PrimaryButton>
              </>
            )
        )}
        {canReport && <PrimaryButton onClick={onReport} variant={canDaily ? "outline" : "primary"}>최종 리포트 보기</PrimaryButton>}
        {!session.completed && done === 0 && session.dailyLogs.length > 0 && <p className="text-center text-[12px] text-charcoal/65">쉬어간 기간이 길어서 새 씨앗부터 다시 시작해요. 오늘 다시 심어볼까요?</p>}
      </div>

      <SkinTipScene concerns={session.selectedConcerns} />

      {session.dailyLogs.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] tracking-brand text-muted-foreground uppercase mb-2">전체 기록된 날짜</div>
          <div className="space-y-1.5">
            {session.dailyLogs.map(l => (
              <div key={l.date} className="glass-pill flex justify-between text-[13px] py-2 px-3 rounded-full">
                <span className="text-plum">DAY {l.day}</span>
                <span className="tnum text-muted-foreground">{l.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!session.profileDone && (
        <div className="glass-surface mt-6 rounded-2xl p-4 text-left">
          <div className="text-[11px] tracking-brand text-muted-foreground uppercase">선택 · 1분이면 돼요</div>
          <p className="mt-2 text-[13px] leading-[1.6] text-plum">피부 타입, 생리 주기 항목, 사는 지역을 알려주면 생리 전후와 날씨까지 함께 비교해드려요.</p>
          <button type="button" onClick={onProfile} className="mt-3 rounded-full border border-white/80 bg-white/50 px-4 py-2.5 text-[13px] font-semibold text-plum">프로필 채우기</button>
        </div>
      )}
      <TodayCard session={session} setSession={setSession} />
      <CycleCard session={session} />
      <ReminderCard />
      <PeriodCard session={session} setSession={setSession} />
      <ForecastCard session={session} />

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
  const day = Math.min(currentStreak(session.dailyLogs, todayISO()) + 1, 7);
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
    const date = todayISO();
    if (session.completed || session.dailyLogs.some(log => log.date === date)) {
      showToast("오늘 기록은 이미 완료했어요.");
      return;
    }
    const sleepMin = sleepMinutesFromTimes(bedtime, wakeTime);
    const log: DailyLog = {
      day, date,
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
    const completed = hasCompletedChallenge(newLogs);
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
              <MoodScoreCard key={k} concern={k} value={concernScores[k] ?? null}
                onChange={v => setConcernScores({ ...concernScores, [k]: v })} />
            ))}
          </div>
          <Section title="숲사이 앰플을 사용했어요">
            <div className="grid grid-cols-2 gap-2">
              <Chip active={ampoule === true} onClick={() => setAmpoule(true)}>네, 사용했어요</Chip>
              <Chip active={ampoule === false} onClick={() => setAmpoule(false)}>아니요</Chip>
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
    menstrual: "#E7A6B8", mask: "#B7B0A6", newcosmetic: "#C9A84C", latecleanse: "#2E3A5F", skippedcleanse: "#5C6F8F",
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
    skippedcleanse: "bg-[#5C6F8F]/15 border-[#5C6F8F] text-plum",
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
function DayComplete({ session, setSession, onContinue }: { session: RecoverySession; setSession: (session: RecoverySession) => void; onContinue: () => void }) {
  const last = session.dailyLogs[session.dailyLogs.length - 1];
  const growth = growthProgress(session, todayISO());
  const done = growth.day;
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

  const insight = dailyInsight(session);

  const emotionLine = last?.emotions.length
    ? `오늘은 ${last.emotions.map(e => EMOTION_LABEL[e]).join("·")}${last.contextFactors.filter(c => c !== "none").length ? " · " + last.contextFactors.filter(c => c !== "none").map(c => CONTEXT_LABEL[c]).join("·") : ""}이(가) 함께 기록됐어요.`
    : null;

  return (
    <Screen
      footer={<PrimaryButton onClick={onContinue}>{session.completed ? "내 리포트 보기" : "진행 현황으로"}</PrimaryButton>}
    >
      <div className="pt-5 text-center">
        <div className="inline-flex items-center rounded-full border border-white/80 bg-white/40 px-4 py-1.5 text-[11px] font-semibold tracking-brand text-forest">오늘의 성장 +{80 + (growth.wateredToday ? 20 : 0) + (growth.fertilizedToday ? 30 : 0)} XP</div>
        <FlowerGarden day={day} canWater={growth.canWater} wateredToday={growth.wateredToday} canFertilize={growth.canFertilize} fertilizedToday={growth.fertilizedToday} onWater={() => waterToday(session, setSession)} onFertilize={() => fertilizeToday(session, setSession)} />
        <div className="text-[11px] tracking-brand text-muted-foreground uppercase mt-1">DAY {day} · COMPLETE</div>
        <h2 className="font-serif text-[26px] text-plum mt-2">{day === 1 ? "첫 새싹이 올라왔어요" : day === 2 ? "새 잎이 펼쳐졌어요" : day === 7 ? "찔레꽃이 피었어요" : "오늘 기록 완료"}</h2>
        <p className="text-[13px] text-muted-foreground mt-1">{done}일 기록했어요. 하루 쉬어가도 식물은 그대로예요.</p>
        {!session.completed && <p className="text-[13px] text-charcoal/70 mt-1">개화까지 {7 - done}일 남았어요.</p>}
        {session.completed && <p className="text-[13px] text-plum mt-2">7일 챌린지를 완성했어요. 리포트를 확인해보세요.</p>}
      </div>

      <div className="mt-5"><GrowthMeter session={session} /></div>
      <PlantIdentity session={session} onNameChange={plantName => setSession({ ...session, plantName })} />

      <div className="mt-6 flex justify-center gap-2" aria-label={`7일 챌린지 ${done}일 완료`}>
        {Array.from({ length: 7 }, (_, index) => <span key={index} className={`flex h-9 w-9 items-center justify-center rounded-full border text-[12px] font-semibold ${index < done ? "border-white bg-white/65 text-plum" : "border-white/65 bg-white/20 text-charcoal/40"}`}>{index < done ? "✓" : index + 1}</span>)}
      </div>
      <SkinTipScene concerns={session.selectedConcerns} />
      {session.completed && <RewardRequest session={session} />}

      <div className="mt-8 space-y-2">
        {changes.map((t, i) => (
          <Card key={i}><div className="text-[13px] leading-[1.6] text-plum">{t}</div></Card>
        ))}
        {emotionLine && <Card><div className="text-[13px] leading-[1.6] text-charcoal/75">{emotionLine}</div></Card>}
        <Card>
          <div className="text-[11px] tracking-brand text-muted-foreground uppercase">내 리포트에 쌓이는 중</div>
          {insight.versusYesterday && <div className="mt-1.5 text-[13px] leading-[1.6] text-plum">{insight.versusYesterday}</div>}
          <div className="mt-1 text-[12px] leading-[1.6] text-charcoal/70">{insight.evidence}</div>
        </Card>
      </div>
    </Screen>
  );
}

function RewardRequest({ session }: { session: RecoverySession }) {
  const [copied, setCopied] = useState(false);
  const requestText = `SOOPSAI 7일 피부 일기 챌린지를 완료했어요. 쿠폰 신청 ID: ${session.id.slice(0, 8).toUpperCase()}`;
  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(requestText);
      setCopied(true);
    } catch {
      window.prompt("아래 문구를 복사해 DM으로 보내주세요.", requestText);
    }
  };
  return (
    <div className="mt-6 rounded-[8px] border border-white/70 bg-white/35 p-4 text-left">
      <div className="text-[11px] tracking-brand text-plum/60">7-DAY REWARD</div>
      <h3 className="mt-1 font-serif text-[17px] text-plum">7일 챌린지 달성</h3>
      <p className="mt-2 text-[12px] leading-5 text-charcoal/70">3,000원 쿠폰은 인스타그램 DM으로 신청하세요. 운영자가 기록을 확인한 뒤 발급 방법과 사용 조건을 안내합니다.</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={copyRequest} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white bg-white/40 px-3 text-[12px] font-semibold text-plum">
          <Copy size={15} aria-hidden="true" />{copied ? "신청 문구 복사됨" : "신청 문구 복사"}
        </button>
        <a href="https://ig.me/m/soopsai_official" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white bg-white/65 px-3 text-[12px] font-semibold text-plum">
          <Instagram size={16} aria-hidden="true" />인스타그램 DM 열기
        </a>
      </div>
      <p className="mt-2 text-[11px] text-charcoal/55">DM을 열고 복사한 문구와 완료 화면 캡처를 보내주세요. 이 화면만으로 쿠폰이 발급되지는 않습니다.</p>
    </div>
  );
}

/* =============================================================================
   REPORT
============================================================================= */
function Report({ session, demoMode, onBack, onReset, onNext, priors, onWithdraw }: { session: RecoverySession; demoMode: boolean; onBack: () => void; onReset: () => void; onNext: (experiment?: Experiment) => void; priors: Record<string, Prior>; onWithdraw: () => void }) {
  const [shareStatus, setShareStatus] = useState("");
  const results = useMemo(() => concernResults(session), [session]);
  const usage = useMemo(() => ampouleUsageRate(session), [session]);
  const compl = useMemo(() => completionRate(session), [session]);
  const factors = useMemo(() => lifestyleFactors(session, { priors }), [session, priors]);
  const rtype = useMemo(() => recoveryType(session, factors), [session, factors]);
  const action = useMemo(() => nextAction(factors), [factors]);
  const change = useMemo(() => changeHeadline(session), [session]);
  const notable = useMemo(() => bestAndWorstDays(session), [session]);
  const evidence = useMemo(() => reportEvidence(session), [session]);

  const sortedResults = [...results].sort((a, b) => b.delta - a.delta);
  const overall = overallChange(session);
  const top = factors[0];
  const subject = results.length === 1 ? results[0].label : "피부 불편";
  const verdictLabel = { better: "좋아졌어요", same: "큰 변화는 없어요", worse: "더 나빠졌어요" } as const;
  const shareReport = async () => {
    const lines = [
      "SOOPSAI · 나만의 7일 피부 일기",
      top ? `'${top.label}'이 있던 날 ${subject} 점수가 평균 ${Math.abs(top.diff).toFixed(1)}점 ${top.diff > 0 ? "높았어요" : "낮았어요"}` : "아직 뚜렷한 신호는 없어요",
      overall ? `피부 변화: ${verdictLabel[overall.verdict]} (${overall.baseline.toFixed(1)}점 → ${overall.recent.toFixed(1)}점)` : "",
      top ? `비교: 있던 날 ${top.withDays}일 · 없던 날 ${top.withoutDays}일` : "",
      `나의 유형: ${rtype.label}${rtype.tentative ? " (잠정)" : ""}`,
      `다음 7일: ${action.title}`,
      ...results.map(result => `${result.label}: ${result.start}점 → ${result.end}점`),
      "내 기록 기준이며 진단이나 원인 판정은 아니에요.",
      window.location.origin,
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "SOOPSAI 7일 피부 일기", text });
        setShareStatus("리포트 요약을 공유했어요.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareStatus("리포트 요약을 복사했어요.");
      } else {
        window.prompt("리포트 요약을 복사해 공유하세요.", text);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("공유하지 못했어요. 다시 시도해주세요.");
    }
  };

  return (
    <div className="min-h-full">
      <TopBar subtitle={demoMode ? "DEMO REPORT" : "FINAL REPORT"} title="7-Day Bloom Report" onBack={onBack} />

      <main className="px-5 pb-16 pt-2 space-y-5">
        {/* HERO */}
        <div
          className="print-avoid-break text-white rounded-3xl p-6 relative overflow-hidden shadow-[0_20px_44px_-16px_rgba(36,21,43,0.5)]"
          style={{ backgroundImage: "linear-gradient(138deg, rgba(36,21,43,0.94) 0%, rgba(81,48,96,0.9) 46%, rgba(158,183,232,0.74) 135%)" }}
        >
          <div aria-hidden className="absolute inset-0 opacity-60" style={{ background: "linear-gradient(118deg, transparent 4%, rgba(231,166,184,0.42) 36%, transparent 58%), linear-gradient(72deg, rgba(158,183,232,0.34), transparent 42%)", filter: "blur(10px)" }} />
          <div className="absolute -right-6 -bottom-6 opacity-95">
            <BloomFlower day={7} size={180} />
          </div>
          <div className="relative z-10 text-[10px] tracking-brand text-white/60 uppercase">RECOVERY REPORT · N°{session.id.slice(0,6).toUpperCase()}</div>
          <div className="relative z-10 font-serif tracking-[0.3em] text-[16px] text-white/85 mt-1">SOOPSAI</div>
          <div className="relative z-10 mt-5 max-w-[250px] space-y-4">
            <div>
              <div className="text-[10px] tracking-brand text-white/60 uppercase">① 이번 7일, 달라진 점</div>
              <div className="mt-1 font-serif text-[22px] font-bold leading-tight text-white">{overall ? verdictLabel[overall.verdict] : "기록을 더 쌓아주세요"}</div>
              {overall && <p className="tnum mt-1 text-[12px] leading-[1.5] text-white/80">평균 {overall.baseline.toFixed(1)}점 → {overall.recent.toFixed(1)}점{change && change.direction !== "same" ? ` · ${change.title}` : ""}</p>}
            </div>
            <div>
              <div className="text-[10px] tracking-brand text-white/60 uppercase">② 나는 이런 유형</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-serif text-[22px] font-bold leading-tight text-white">{rtype.label}</span>
                {rtype.tentative && <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px] text-white/80">잠정</span>}
              </div>
              {top && <p className="tnum mt-1 text-[12px] leading-[1.5] text-white/80">'{top.label}'이 있던 날 평균 {Math.abs(top.diff).toFixed(1)}점 {top.diff > 0 ? "높았어요" : "낮았어요"} (있던 날 {top.withDays}일 · 없던 날 {top.withoutDays}일)</p>}
            </div>
            <div>
              <div className="text-[10px] tracking-brand text-white/60 uppercase">③ 다음 7일, 이렇게 해보세요</div>
              <p className="mt-1 font-serif text-[16px] leading-[1.45] text-white/95">{action.title}</p>
            </div>
          </div>
          <p className="relative z-10 mt-4 text-[10px] text-white/55">내 기록 기준이에요 · 진단이나 원인 판정은 아니에요</p>
        </div>

        {/* 한눈에 */}
        <div className="grid grid-cols-2 gap-3 print-avoid-break">
          <Card className="min-h-[104px]">
            <div className="text-[11px] tracking-brand text-muted-foreground uppercase">피부 변화</div>
            <div className="mt-2 font-serif text-[19px] font-bold leading-tight text-plum">{overall ? verdictLabel[overall.verdict] : "–"}</div>
            {overall && <div className="tnum mt-1 text-[12px] text-charcoal/65">{overall.baseline.toFixed(1)}점 → {overall.recent.toFixed(1)}점</div>}
          </Card>
          <Card className="min-h-[104px]">
            <div className="text-[11px] tracking-brand text-muted-foreground uppercase">내 신호 1순위</div>
            <div className="mt-2 font-serif text-[19px] font-bold leading-tight text-plum break-keep">{top ? top.label : "아직 없어요"}</div>
            <div className="mt-1 text-[12px] text-charcoal/65">{top ? (top.diff > 0 ? "점수가 올라가는 쪽" : "점수가 내려가는 쪽") : "기록이 더 필요해요"}</div>
          </Card>
        </div>
        <Card className="print-avoid-break">
          <div className="text-[11px] tracking-brand text-muted-foreground uppercase">다음 7일, 이렇게 해봐요</div>
          <p className="mt-2 font-serif text-[16px] leading-[1.5] text-plum">{action.title}</p>
          <ol className="mt-3 space-y-1.5 text-[13px] leading-[1.6] text-charcoal/80">
            {action.steps.map((step, i) => <li key={step} className="flex gap-2"><span className="tnum font-semibold text-plum">{i + 1}</span><span>{step}</span></li>)}
          </ol>
        </Card>

        {/* Small cards */}
        <div className="grid grid-cols-2 gap-3 print-avoid-break">
          <Card className="min-h-[110px]">
            <div className="text-[11px] tracking-brand text-muted-foreground uppercase">기록한 날</div>
            <div className="tnum font-bold text-plum mt-2" style={{ fontSize: 32 }}>{evidence.loggedDays}일</div>
            <div className="text-[11px] text-muted-foreground mt-1 tnum">점수 기록 {evidence.scoredDays}일</div>
          </Card>
          <Card className="min-h-[110px]">
            <div className="text-[11px] tracking-brand text-muted-foreground uppercase">숲사이 앰플 사용 기록</div>
            <div className="tnum font-bold text-plum mt-2" style={{ fontSize: 32 }}>{usage}%</div>
            <div className="text-[11px] text-muted-foreground mt-1 tnum">기록 {evidence.loggedDays}일 기준</div>
          </Card>
        </div>

        <div className="flex justify-between text-[11px] text-muted-foreground px-1 tnum print-avoid-break">
          <span>완료율 {compl}%</span>
          <span>기록 {evidence.loggedDays}일</span>
          <span>선택 고민 {session.selectedConcerns.length}개</span>
        </div>

        <details className="glass-surface print-avoid-break rounded-2xl p-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-plum">이 리포트의 근거 기록 · <span className="tnum">{evidence.scoredDays}일</span></summary>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {evidence.dates.map(date => <span key={date} className="tnum rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] text-charcoal/70">{date.slice(5)}</span>)}
            {evidence.skippedDates.map(date => <span key={date} className="tnum rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground">{date.slice(5)} 쉬어감</span>)}
          </div>
          <p className="mt-2 text-[11px] leading-[1.5] text-muted-foreground">아래 숫자는 이 날짜에 직접 입력한 기록으로만 계산했어요. 쉬어간 날은 넣지 않았어요.</p>
        </details>

        {notable && (
          <section className="space-y-3">
            <SectionTitle n="BEST & WORST DAY" title="가장 편했던 날과 불편했던 날" />
            <div className="grid grid-cols-2 gap-3 print-avoid-break">
              {([["편했던 날", notable.best], ["불편했던 날", notable.worst]] as const).map(([title, day]) => (
                <Card key={title}>
                  <div className="text-[11px] tracking-brand text-muted-foreground uppercase">{title}</div>
                  <div className="mt-1 tnum font-bold text-plum text-[22px]">{day.score}점</div>
                  <div className="tnum text-[11px] text-muted-foreground">{day.date.slice(5)}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {day.tags.map(tag => <span key={tag} className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] text-charcoal/70">{tag}</span>)}
                  </div>
                </Card>
              ))}
            </div>
            <p className="px-1 text-[11px] leading-[1.5] text-muted-foreground">두 날을 그대로 보여드릴 뿐, 이 차이가 무엇 때문인지는 알 수 없어요.</p>
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle n="SIGNALS" title="내 피부 신호" />
          {factors.length === 0
            ? <Card><div className="text-[13px] text-charcoal/70 leading-[1.6]">각 요인이 있던 날과 없던 날을 2일 이상씩 비교할 자료가 부족하거나, 평균 차이가 0.5점 미만이었어요.</div></Card>
            : factors.map((f, i) => (
                <Card key={f.key} className="print-avoid-break">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-serif text-[17px] text-plum">{i + 1}. {f.label}</div>
                    <div className={`tnum shrink-0 font-bold text-[20px] ${f.diff > 0 ? "text-destructive" : "text-moss"}`}>{f.diff > 0 ? "+" : ""}{f.diff.toFixed(1)}점</div>
                  </div>
                  <div className="mt-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${f.clear ? "bg-moss/15 text-moss" : f.confidence === "repeated" ? "bg-moss/10 text-moss" : "bg-secondary text-charcoal/60"}`}>
                      {f.clear ? "확실해 보여요" : f.confidence === "repeated" ? "여러 날 반복" : "아직 참고용"}
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] leading-[1.6] text-charcoal/80 tnum">있던 날 {f.withDays}일 평균 <b>{f.withAvg.toFixed(1)}점</b> · 없던 날 {f.withoutDays}일 평균 <b>{f.withoutAvg.toFixed(1)}점</b></div>
                  <details className="mt-2 text-[11px] leading-[1.6] text-charcoal/65">
                    <summary className="cursor-pointer font-semibold text-forest">자세히 보기</summary>
                    <p className="mt-1 tnum">있던 날 {f.withDates.map(d => d.slice(5)).join(", ")} / 없던 날 {f.withoutDates.map(d => d.slice(5)).join(", ")}</p>
                    <p className="mt-1 tnum">기록이 적을 땐 차이를 보수적으로 줄여 추정해요 · 추정 {f.shrunkDiff > 0 ? "+" : ""}{f.shrunkDiff.toFixed(1)}점 (범위 {f.ciLow.toFixed(1)} ~ {f.ciHigh.toFixed(1)})</p>
                    {f.lagged && <p className="mt-1">전날 기록과 다음 날 피부 점수를 이어서 비교했어요.</p>}
                    {f.literature && <p className="mt-1">{f.literature}</p>}
                  </details>
                </Card>
              ))}
          <details className="px-1 text-[11px] leading-[1.6] text-charcoal/65">
            <summary className="cursor-pointer font-semibold text-forest">분석 기준 보기</summary>
            <p className="mt-2">그날 선택한 고민 점수의 평균을 사용했어요. 생활 요인이 있던 날과 없던 날이 각각 2일 이상이고 평균 차이가 0.5점 이상인 경우만 표시합니다. 7일 기록의 탐색적 비교이며 통계적 유의성이나 제품 효과를 뜻하지 않아요.</p>
          </details>
        </section>

        {/* Concern change cards */}
        <section className="space-y-3">
          <SectionTitle n="CONCERN CHANGE" title="고민별 변화" />
          {sortedResults.map(r => (
            <Card key={r.key} className="print-avoid-break">
              <div className="flex items-baseline justify-between">
                <div className="font-serif text-[17px] text-plum">{r.label}</div>
                <div className="tnum font-bold text-plum text-[22px]">
                  {r.delta > 0 ? `-${r.delta}점` : r.delta < 0 ? `+${-r.delta}점` : "변화 없음"}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="tnum text-[13px] text-muted-foreground">{r.start}점 → {r.end}점</div>
                <div className="flex-1"><Sparkline data={r.series} /></div>
              </div>
              <div className="text-[12px] text-charcoal/70 mt-2 leading-[1.6]">
                {r.delta > 0 ? `${r.label} 불편 점수가 시작일보다 ${r.delta}점 낮게 기록됐어요.` : r.delta < 0 ? `${r.label} 불편 점수가 시작일보다 ${-r.delta}점 높게 기록됐어요.` : "시작일과 같은 점수로 기록됐어요."}
                <span className="block text-[11px] text-muted-foreground mt-1">{r.meaningful ? "눈에 띄게 달라졌어요" : "큰 변화는 없어요"}</span>
              </div>
            </Card>
          ))}
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

        {!demoMode && <RewardRequest session={session} />}

        {!demoMode && session.completed && (
          <Card className="print-avoid-break">
            <div className="text-[11px] tracking-brand text-muted-foreground uppercase">기록이 쌓일수록 더 분명해져요</div>
            <p className="mt-2 text-[12px] leading-[1.6] text-charcoal/75">다음 7일을 이어서 기록하면 이번 기록과 합쳐서 비교해요. 같은 요인이 있던 날과 없던 날이 늘어날수록 추정 범위가 좁아지고, 우연일 가능성이 줄어들어요.</p>
            <div className="mt-3 space-y-2">
              {top && <PrimaryButton onClick={() => onNext(startExperiment(top, todayISO()))}>{action.title}, 이어서 기록하기</PrimaryButton>}
              <PrimaryButton onClick={() => onNext()} variant={top ? "outline" : "primary"}>{top ? "실험 없이 이어서 기록하기" : "다음 7일 이어서 기록하기"}</PrimaryButton>
            </div>
          </Card>
        )}

        <div className="pt-4 no-print space-y-3">
          {!demoMode && <PrimaryButton onClick={shareReport}><span className="inline-flex items-center gap-2"><Share2 size={17} aria-hidden="true" />리포트 요약 공유</span></PrimaryButton>}
          {shareStatus && <p className="text-center text-[12px] text-plum" role="status">{shareStatus}</p>}
          <PrimaryButton onClick={() => window.print()} variant="outline">인쇄 · PDF로 저장</PrimaryButton>
          {!demoMode && session.cloudConsent && <button onClick={onWithdraw} className="mx-auto block text-[12px] text-muted-foreground underline">서버 기록 삭제 · 동의 철회</button>}
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
