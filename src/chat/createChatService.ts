import type { ChatService } from './ChatService'
import { MockChatService } from './MockChatService'
import { getClientId } from '../logic/storage'

/**
 * 依環境變數 VITE_CHAT_BACKEND 決定用哪一個聊天服務。
 * 階段二:在這裡加上 supabase 的分支,其餘程式不用改。
 */
export function createChatService(): ChatService {
  const backend = import.meta.env.VITE_CHAT_BACKEND ?? 'mock'
  if (backend === 'mock') {
    // 網址加上 ?empty 可以看「沒有人說話」的空聊天室
    const empty = new URLSearchParams(window.location.search).has('empty')
    return new MockChatService(getClientId(), { empty })
  }
  throw new Error(`聊天服務「${backend}」還沒有實作(階段二才會接上 Supabase)。`)
}
