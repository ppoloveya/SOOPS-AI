import { useEffect, useRef, useState } from "react";
import { Droplet, Sparkles } from "lucide-react";
import { BloomFlower } from "./BloomFlower";

type Props = {
  day: number;
  canWater: boolean;
  wateredToday: boolean;
  canFertilize: boolean;
  fertilizedToday: boolean;
  onWater: () => void;
  onFertilize: () => void;
};

export function FlowerGarden({ day, canWater, wateredToday, canFertilize, fertilizedToday, onWater, onFertilize }: Props) {
  const [watering, setWatering] = useState(false);
  const [fertilizing, setFertilizing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fertilizerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (fertilizerTimer.current) clearTimeout(fertilizerTimer.current);
  }, []);

  const water = () => {
    if (!canWater || watering) return;
    setWatering(true);
    onWater();
    timer.current = setTimeout(() => setWatering(false), 1300);
  };

  const fertilize = () => {
    if (!canFertilize || fertilizing) return;
    setFertilizing(true);
    onFertilize();
    fertilizerTimer.current = setTimeout(() => setFertilizing(false), 1300);
  };

  return (
    <div className={`flower-garden ${wateredToday ? "flower-garden-watered" : ""} ${fertilizedToday ? "flower-garden-fertilized" : ""}`}>
      <div className="flower-garden-light" aria-hidden="true" />
      <div className="flower-garden-plant" key={day}>
        <BloomFlower day={day} size={148} />
      </div>
      <div className="flower-garden-soil" aria-hidden="true" />
      {watering && <div className="flower-garden-water" aria-hidden="true">
        {[0, 1, 2, 3].map(index => <Droplet key={index} className="flower-garden-drop" size={12} fill="currentColor" style={{ animationDelay: `${index * 130}ms` }} />)}
      </div>}
      {fertilizing && <div className="flower-garden-nutrients" aria-hidden="true">
        {[0, 1, 2, 3].map(index => <Sparkles key={index} className="flower-garden-nutrient" size={13} style={{ animationDelay: `${index * 120}ms` }} />)}
      </div>}
      <button type="button" className="flower-garden-fertilizer" onClick={fertilize} disabled={!canFertilize || fertilizing}
        aria-label={canFertilize ? "꽃에 비료주기, 30 XP" : fertilizedToday ? "오늘 비료주기 완료" : "2, 4, 6일차에 물을 준 뒤 비료주기 가능"}
        title={canFertilize ? "꽃에 비료주기 · +30 XP" : fertilizedToday ? "오늘 비료주기 완료" : "2·4·6일차에 물을 준 뒤 가능"}>
        <img src="/soopsai-fertilizer.png" alt="" className="flower-garden-fertilizer-art" draggable={false} />
        <span>{fertilizedToday ? "비료줌" : "비료주기"}</span>
      </button>
      <button type="button" className="flower-garden-can" onClick={water} disabled={!canWater || watering}
        aria-label={canWater ? "꽃에 물주기, 20 XP" : wateredToday ? "오늘 물주기 완료" : "오늘 기록 후 물주기 가능"}
        title={canWater ? "꽃에 물주기 · +20 XP" : wateredToday ? "오늘 물주기 완료" : "오늘 기록 후 물주기 가능"}>
        <img src="/soopsai-watering-can.png" alt="" className="flower-garden-can-art" draggable={false} />
        <span>{wateredToday ? "물줌" : "물주기"}</span>
      </button>
    </div>
  );
}
