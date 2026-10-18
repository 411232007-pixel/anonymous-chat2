// 搜尋訊息(新增功能 A)。只在自己的畫面上篩選目前已載入的訊息,不經過伺服器。
// 高亮用「把文字切成片段」的方式,由畫面一律當純文字顯示,不產生任何 HTML。

export const SEARCH_MAX = 50

export interface Piece {
  text: string
  match: boolean
}

/** 去掉前後空白、限制長度。空字串代表「沒有在搜尋」 */
export function cleanQuery(raw: string): string {
  return Array.from(raw.trim()).slice(0, SEARCH_MAX).join('')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matcher(query: string): RegExp | null {
  const q = cleanQuery(query)
  return q === '' ? null : new RegExp(escapeRegExp(q), 'giu')
}

/** 內容或代號含有搜尋字(不分大小寫)。沒有搜尋字時一律符合 */
export function matchesQuery(fields: string[], query: string): boolean {
  const re = matcher(query)
  if (!re) return true
  return fields.some((field) => {
    re.lastIndex = 0
    return re.test(field)
  })
}

/** 把文字切成「符合」與「不符合」的片段,供畫面標示 */
export function splitByQuery(text: string, query: string): Piece[] {
  const re = matcher(query)
  if (!re) return [{ text, match: false }]
  const pieces: Piece[] = []
  let last = 0
  for (const found of text.matchAll(re)) {
    const start = found.index ?? 0
    if (found[0] === '') continue
    if (start > last) pieces.push({ text: text.slice(last, start), match: false })
    pieces.push({ text: found[0], match: true })
    last = start + found[0].length
  }
  if (last < text.length) pieces.push({ text: text.slice(last), match: false })
  return pieces.length > 0 ? pieces : [{ text, match: false }]
}
