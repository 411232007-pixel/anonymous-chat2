import type { ChatEventName, ChatEvents, Unsubscribe } from './types'

/**
 * 聊天服務介面:畫面只認識這一份合約,不知道背後是假的還是真的。
 * 階段一:MockChatService(機器人 + 分頁互傳)。階段二:接 Supabase 的版本。
 * 動作的結果一律透過事件回報(見 types.ts 的 ChatEvents)。
 */
export interface ChatService {
  /** 這個分頁的識別碼 */
  readonly clientId: string
  on<E extends ChatEventName>(event: E, handler: (payload: ChatEvents[E]) => void): Unsubscribe
  /** 加入聊天室。成功 → join:accepted;代號重複 → join:rejected */
  join(nickname: string): void
  /** 送出一則已清理、已檢查過的訊息。失敗 → message:failed */
  sendMessage(content: string): void
  /** 告訴其他人「我正在輸入 / 停止輸入」。服務會自己限制發送次數,畫面可以每次按鍵都呼叫 */
  setTyping(typing: boolean): void
  /** 主動離開(使用者沒有離開鈕,關掉分頁會自動離開) */
  leave(): void
  /** 只有假服務才有:手動製造斷線、送出失敗等情況,方便測試畫面 */
  readonly debug?: DebugControls
}

export interface DebugControls {
  isOffline(): boolean
  setOffline(offline: boolean): void
  failNextSend(): void
  clearStoredMessages(): void
}
