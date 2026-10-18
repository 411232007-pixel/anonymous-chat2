import { hasHiddenChar } from './unicode'

export const NICKNAME_MAX = 12

export type NicknameError = 'empty' | 'too_long' | 'invalid_chars'

export type NicknameResult =
  | { ok: true; nickname: string }
  | { ok: false; error: NicknameError }

// 至少要有一個看得見的字元(文字、數字、標點、符號、emoji)
const VISIBLE = /[\p{L}\p{N}\p{P}\p{S}]/u

/** 以「字」(不是位元組)計算長度,emoji 算 1 個 */
export function countChars(text: string): number {
  return Array.from(text).length
}

/** 去掉前後空白,中間連續空白合併成一個 */
export function tidyNickname(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function validateNickname(raw: string): NicknameResult {
  if (hasHiddenChar(raw)) return { ok: false, error: 'invalid_chars' }
  const nickname = tidyNickname(raw)
  if (nickname === '' || !VISIBLE.test(nickname)) return { ok: false, error: 'empty' }
  if (countChars(nickname) > NICKNAME_MAX) return { ok: false, error: 'too_long' }
  return { ok: true, nickname }
}

/**
 * 比對「是否同一個代號」時用的標準形:
 * 全形轉半形、轉小寫、空白標準化。「Ming」和「ＭＩＮＧ」會被視為相同。
 */
export function normalizeNickname(nickname: string): string {
  return tidyNickname(nickname.normalize('NFKC')).toLowerCase()
}
