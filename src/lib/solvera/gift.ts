/**
 * 비동기 선물: 친구가 공유 링크에서 물·거름을 보내면 받는 사람 식물 옆에 "응원 N개"로 보인다.
 * 성장 경험치(XP)에는 더하지 않는다 — 여러 기기로 경험치를 불리는 일을 막고, 기록이 곧 성장이라는 원칙을 지키기 위해서다.
 * 링크에는 식물을 식별하는 임의 토큰(16자리 16진수)만 들어가고, 계정·이름·건강 정보는 연결되지 않는다.
 */
export type GiftKind = "water" | "fertilizer";
export const GIFT_LABEL: Record<GiftKind, string> = { water: "물", fertilizer: "거름" };

const TOKEN_KEY = "soopsai:share-token";
const TOKEN_PATTERN = /^[0-9a-f]{16}$/;

export function isValidToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** 내 식물의 공유 토큰. 처음 공유할 때 만들고 기기에 보관한다. */
export function getShareToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!isValidToken(token)) {
    token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

/** 같은 기기가 같은 식물에 같은 날 같은 선물을 두 번 보내지 못하게 하는 기기 쪽 안전장치(서버에도 일일 상한이 있다). */
export function giftSentKey(token: string, kind: GiftKind, date: string): string {
  return `soopsai:gift:${token}:${kind}:${date}`;
}

interface RpcClient {
  rpc: (fn: string, args: Record<string, string>) => Promise<{ data: unknown; error: unknown }>;
}
async function rpc(): Promise<RpcClient> {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase as unknown as RpcClient;
}

export async function sendGift(token: string, kind: GiftKind): Promise<boolean> {
  if (!isValidToken(token)) return false;
  try {
    const { data, error } = await (await rpc()).rpc("send_plant_gift", { p_token: token, p_kind: kind });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function fetchGiftCount(token: string): Promise<{ water: number; fertilizer: number }> {
  const empty = { water: 0, fertilizer: 0 };
  if (!isValidToken(token)) return empty;
  try {
    const { data, error } = await (await rpc()).rpc("plant_gift_count", { p_token: token });
    if (error || !data || typeof data !== "object") return empty;
    const row = data as { water?: unknown; fertilizer?: unknown };
    return { water: Number(row.water) || 0, fertilizer: Number(row.fertilizer) || 0 };
  } catch {
    return empty;
  }
}
