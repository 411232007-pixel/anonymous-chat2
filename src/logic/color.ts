import { normalizeNickname } from './nickname'

/** 色票共幾色(實際色碼在 styles/tokens.css 的 --u0 ~ --u7) */
export const USER_COLOR_COUNT = 8

/** 由代號算出固定的色票索引:同一個代號永遠得到同一個顏色 */
export function colorIndex(nickname: string): number {
  let h = 0x811c9dc5
  for (const ch of normalizeNickname(nickname)) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12
  return (h >>> 0) % USER_COLOR_COUNT
}
