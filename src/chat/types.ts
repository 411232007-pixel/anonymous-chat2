// 資料格式與事件名稱:對應 docs/architecture.md 第 5 節。
// 畫面、假服務、真服務都照這份「合約」,所以階段二只要換掉服務,畫面不用動。

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting'

/** 線上使用者。clientId 是這個分頁的隨機識別碼,不是帳號。 */
export interface User {
  clientId: string
  nickname: string
  /** 加入時間(毫秒時間戳),同時搶同一個代號時,較早的人勝出 */
  joinedAt: number
}

export interface Message {
  /** 嚴格遞增。用來排序,也用來斷線後補抓「比這個編號新的訊息」 */
  id: number
  clientId: string
  /** 送出當下的代號 */
  nickname: string
  /** 純文字,1~500 字 */
  content: string
  /** 送出時間(ISO 8601),階段二由資料庫決定 */
  createdAt: string
}

export type JoinRejectReason = 'nickname_taken'

/** 服務發給畫面的事件。事件名稱 → 帶的資料 */
export interface ChatEvents {
  'connection:status': ConnectionStatus
  'join:accepted': { users: User[] }
  'join:rejected': { reason: JoinRejectReason }
  'history:loaded': Message[]
  'message:new': Message
  'message:failed': { content: string; reason: string }
  'presence:sync': User[]
  'presence:joined': User
  'presence:left': User
}

export type ChatEventName = keyof ChatEvents
export type Unsubscribe = () => void
