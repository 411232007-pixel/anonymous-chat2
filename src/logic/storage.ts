// 瀏覽器的本機儲存可能讀寫失敗(無痕視窗、被封鎖等),所以每次都包 try/catch,
// 失敗時畫面照常運作,只是不會「記住」東西。

const NICKNAME_KEY = 'anon-chat:nickname'
const CLIENT_ID_KEY = 'anon-chat:client-id'

function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** 上次用過的代號(只是方便預先填入,不是登入) */
export function loadNickname(): string {
  return attempt(() => localStorage.getItem(NICKNAME_KEY) ?? '', '')
}

export function saveNickname(nickname: string): void {
  attempt(() => localStorage.setItem(NICKNAME_KEY, nickname), undefined)
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

let memoryClientId: string | null = null

/**
 * 這個分頁的識別碼。重新整理後保持不變(讓系統認得「還是同一個人」),
 * 關掉分頁就失效。不是帳號。
 */
export function getClientId(): string {
  if (memoryClientId) return memoryClientId
  const saved = attempt(() => sessionStorage.getItem(CLIENT_ID_KEY), null)
  memoryClientId = saved ?? makeId()
  if (!saved) attempt(() => sessionStorage.setItem(CLIENT_ID_KEY, memoryClientId as string), undefined)
  return memoryClientId
}

export function loadJson<T>(key: string, fallback: T): T {
  return attempt(() => {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  }, fallback)
}

export function saveJson(key: string, value: unknown): void {
  attempt(() => localStorage.setItem(key, JSON.stringify(value)), undefined)
}

export function removeKey(key: string): void {
  attempt(() => localStorage.removeItem(key), undefined)
}
