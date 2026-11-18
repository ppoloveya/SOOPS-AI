import type { RecoverySession, DailyLog } from "./types";
import { EXERCISE_META, EMOTION_SCORE } from "./types";

export function buildDemoSession(): RecoverySession {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const day = (n: number): string => {
    const d = new Date(start); d.setDate(start.getDate() + n - 1);
    return d.toISOString().slice(0, 10);
  };

  const mk = (n: number, o: Partial<DailyLog>): DailyLog => {
    const emotions = o.emotions ?? ["calm"];
    return {
      day: n,
      date: day(n),
      concernScores: o.concernScores ?? {},
      ampouleUsed: o.ampouleUsed ?? true,
      bedtime: o.bedtime ?? "23:30",
      wakeTime: o.wakeTime ?? "07:00",
      sleepMinutes: o.sleepMinutes ?? 450,
      sleepCategory: o.sleepCategory ?? "sixToSeven",
      emotions,
      emotionStressScore: emotions.reduce((s, e) => s + EMOTION_SCORE[e], 0),
      exerciseType: o.exerciseType ?? "walking",
      exerciseMeta: EXERCISE_META[o.exerciseType ?? "walking"],
      contextFactors: o.contextFactors ?? [],
    };
  };

  const logs: DailyLog[] = [
    mk(1, { concernScores:{ redness:6, trouble:8, pores:8 }, emotions:["pressured","sensitive"], exerciseType:"running", contextFactors:["outdoor"], sleepMinutes:360, sleepCategory:"fiveToSix", bedtime:"01:00", wakeTime:"07:00" }),
    mk(2, { concernScores:{ redness:6, trouble:7, pores:7 }, emotions:["tired"], exerciseType:"none", contextFactors:["longtravel"], sleepMinutes:390, sleepCategory:"sixToSeven" }),
    mk(3, { concernScores:{ redness:5, trouble:6, pores:7 }, emotions:["calm","satisfied"], exerciseType:"yoga", contextFactors:[], sleepMinutes:450, sleepCategory:"sixToSeven" }),
    mk(4, { concernScores:{ redness:5, trouble:5, pores:6 }, emotions:["fresh"], exerciseType:"walking", contextFactors:[], sleepMinutes:465 }),
    mk(5, { concernScores:{ redness:6, trouble:4, pores:6 }, emotions:["pressured"], exerciseType:"running", contextFactors:["outdoor"], sleepMinutes:390, ampouleUsed:true }),
    mk(6, { concernScores:{ redness:5, trouble:4, pores:5 }, emotions:["calm"], exerciseType:"pilates", contextFactors:[], sleepMinutes:480, sleepCategory:"overSeven" }),
    mk(7, { concernScores:{ redness:5, trouble:3, pores:5 }, emotions:["satisfied","calm"], exerciseType:"walking", contextFactors:[], sleepMinutes:480, sleepCategory:"overSeven" }),
  ];

  return {
    version: 1,
    id: "demo",
    startedAt: start.toISOString(),
    plantName: "나의 찔레꽃",
    skinType: "combo",
    sensitivity: 3,
    currentCondition: "same",
    showMenstrualFactor: false,
    selectedConcerns: ["redness", "trouble", "pores"],
    baselineScores: { redness: 6, trouble: 8, pores: 8 },
    dailyLogs: logs,
    wateredDates: [],
    fertilizedDates: [],
    completed: true,
  };
}
