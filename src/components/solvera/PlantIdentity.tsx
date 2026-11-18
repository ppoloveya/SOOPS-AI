import { useState, type FormEvent } from "react";
import { Check, Pencil, Share2, X } from "lucide-react";
import { growthProgress } from "@/lib/solvera/growth";
import { todayISO } from "@/lib/solvera/storage";
import { createPlantShareUrl, MAX_PLANT_NAME_LENGTH, normalizePlantName } from "@/lib/solvera/plantShare";
import type { RecoverySession } from "@/lib/solvera/types";

export function PlantIdentity({ session, onNameChange }: { session: RecoverySession; onNameChange: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.plantName);
  const [status, setStatus] = useState("");
  const isLocal = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    const name = normalizePlantName(draft);
    onNameChange(name);
    setDraft(name);
    setEditing(false);
    setStatus("");
  };

  const share = async () => {
    const { day, xp } = growthProgress(session, todayISO());
    const url = createPlantShareUrl(window.location.origin, { name: session.plantName, day, xp });
    const text = `${session.plantName} · ${day}일차 · ${xp} XP`;
    try {
      if (isLocal) {
        await navigator.clipboard.writeText(url);
        setStatus("미리보기 링크를 복사했어요. 친구 공유는 배포 후 가능해요.");
      } else if (navigator.share) {
        await navigator.share({ title: `${session.plantName} | SOOPSAI`, text, url });
        setStatus("식물 링크를 공유했어요.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus("식물 링크를 복사했어요.");
      } else {
        window.prompt("식물 링크를 복사해 공유하세요.", url);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("링크를 복사하지 못했어요. 다시 시도해주세요.");
    }
  };

  return (
    <div className="plant-identity mx-auto mt-5 w-full max-w-[340px] border-t border-white/55 pt-4">
      <div className="text-[10px] tracking-brand text-charcoal/55">내 식물</div>
      {editing ? (
        <form onSubmit={saveName} className="mt-2 flex items-center gap-2">
          <input autoFocus value={draft} onChange={event => setDraft(event.target.value)} maxLength={MAX_PLANT_NAME_LENGTH}
            aria-label="식물 이름" className="min-w-0 flex-1 rounded-full border border-white/80 bg-white/55 px-4 py-2 text-[16px] text-plum outline-none focus:border-forest" />
          <button type="submit" className="plant-identity-icon" aria-label="이름 저장" title="이름 저장"><Check size={17} /></button>
          <button type="button" className="plant-identity-icon" onClick={() => { setDraft(session.plantName); setEditing(false); }} aria-label="이름 변경 취소" title="취소"><X size={17} /></button>
        </form>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <div className="min-w-0 flex-1 break-words font-serif text-[19px] text-plum">{session.plantName}</div>
          <button type="button" className="plant-identity-icon" onClick={() => { setDraft(session.plantName); setEditing(true); }} aria-label="식물 이름 바꾸기" title="식물 이름 바꾸기"><Pencil size={16} /></button>
        </div>
      )}
      <button type="button" onClick={share} className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/45 px-4 py-2 text-[12px] font-semibold text-forest" title="식물 이름·성장일·경험치만 공유">
        <Share2 size={15} aria-hidden="true" />{isLocal ? "공유 미리보기" : "친구에게 공유"}
      </button>
      <div className="mt-2 min-h-4 text-[11px] text-charcoal/60" role="status" aria-live="polite">{status}</div>
    </div>
  );
}
