// 看不見、或會干擾畫面的字元。用數字寫,避免在原始碼裡出現看不見的字。

const HIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x08], // 控制字元
  [0x0b, 0x0c], // 垂直定位、換頁
  [0x0e, 0x1f], // 控制字元
  [0x7f, 0x9f], // 刪除與控制字元
  [0xad, 0xad], // 軟連字號
  [0x200b, 0x200c], // 零寬空白、零寬不連字
  [0x200e, 0x200f], // 左右方向標記
  [0x2028, 0x2029], // 行分隔、段分隔
  [0x202a, 0x202e], // 方向控制(能讓文字顯示順序顛倒,用來偽裝代號)
  [0x2060, 0x2069], // 零寬組合、方向隔離
  [0xfeff, 0xfeff], // 零寬不換行空白
]

/**
 * 是不是「看不見或會干擾畫面」的字元。
 * 刻意不包含 U+200D(零寬連接符):emoji 組合(例如家庭 emoji)需要它。
 * 一般的空白、定位字元、換行(U+0009~U+000A、U+000D)也不算。
 */
export function isHiddenChar(codePoint: number): boolean {
  return HIDDEN_RANGES.some(([from, to]) => codePoint >= from && codePoint <= to)
}

export function hasHiddenChar(text: string): boolean {
  for (const ch of text) if (isHiddenChar(ch.codePointAt(0) ?? 0)) return true
  return false
}

export function stripHiddenChars(text: string): string {
  let result = ''
  for (const ch of text) if (!isHiddenChar(ch.codePointAt(0) ?? 0)) result += ch
  return result
}
