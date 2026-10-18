import { countChars } from './nickname'
import { stripHiddenChars } from './unicode'

export const MESSAGE_MAX = 500

export type MessageError = 'empty' | 'too_long'

export type MessageResult =
  | { ok: true; content: string }
  | { ok: false; error: MessageError }

/** 清理訊息:統一換行、移除危險或看不見的字元、去掉前後空白、連續空行最多留一行 */
export function cleanMessage(raw: string): string {
  return stripHiddenChars(raw.replace(/\r\n?/g, '\n'))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function validateMessage(raw: string): MessageResult {
  const content = cleanMessage(raw)
  if (content === '') return { ok: false, error: 'empty' }
  if (countChars(content) > MESSAGE_MAX) return { ok: false, error: 'too_long' }
  return { ok: true, content }
}

/** 輸入框還能打幾個字(負數代表超過) */
export function remainingChars(draft: string): number {
  return MESSAGE_MAX - countChars(draft.replace(/\r\n?/g, '\n'))
}
