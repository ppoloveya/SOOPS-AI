import { MAX_GROWTH_XP } from "./growth.ts";
import { isValidToken } from "./gift.ts";

export const DEFAULT_PLANT_NAME = "나의 찔레꽃";
export const MAX_PLANT_NAME_LENGTH = 16;

export type PlantSnapshot = { name: string; day: number; xp: number; token?: string };

export function normalizePlantName(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_PLANT_NAME;
  const clean = value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  return Array.from(clean).slice(0, MAX_PLANT_NAME_LENGTH).join("") || DEFAULT_PLANT_NAME;
}

export function parsePlantSnapshot(search: Record<string, unknown>): PlantSnapshot | null {
  if (typeof search.name !== "string" || !["string", "number"].includes(typeof search.day) || !["string", "number"].includes(typeof search.xp)) return null;
  if (search.day === "" || search.xp === "") return null;
  const day = Number(search.day);
  const xp = Number(search.xp);
  if (!Number.isInteger(day) || day < 0 || day > 7 || !Number.isInteger(xp) || xp < 0 || xp > MAX_GROWTH_XP) return null;
  const token = isValidToken(search.t) ? search.t : undefined;
  return token ? { name: normalizePlantName(search.name), day, xp, token } : { name: normalizePlantName(search.name), day, xp };
}

export function createPlantShareUrl(origin: string, snapshot: PlantSnapshot): string {
  const url = new URL("/plant", origin);
  url.searchParams.set("name", normalizePlantName(snapshot.name));
  url.searchParams.set("day", String(snapshot.day));
  url.searchParams.set("xp", String(snapshot.xp));
  if (snapshot.token && isValidToken(snapshot.token)) url.searchParams.set("t", snapshot.token);
  return url.toString();
}
