/** 「正在輸入」那一行要顯示的字。沒有人在輸入時回傳空字串 */
export function typingLabel(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} 正在輸入…`
  if (names.length === 2) return `${names[0]}、${names[1]} 正在輸入…`
  return '多人正在輸入…'
}
