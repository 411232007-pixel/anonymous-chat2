import type { ChatService } from './ChatService'
import { MockChatService } from './MockChatService'
import { SupabaseChatService } from './SupabaseChatService'
import { getClientId } from '../logic/storage'

/**
 * 依環境變數 VITE_CHAT_BACKEND 決定用哪一個聊天服務:
 *  - mock(預設):階段一的假服務
 *  - supabase:階段二的真服務,需要 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY
 */
export function createChatService(): ChatService {
  const backend = import.meta.env.VITE_CHAT_BACKEND ?? 'mock'
  if (backend === 'mock') {
    // 網址加上 ?empty 可以看「沒有人說話」的空聊天室
    const empty = new URLSearchParams(window.location.search).has('empty')
    return new MockChatService(getClientId(), { empty })
  }
  if (backend === 'supabase') {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) {
      throw new Error(
        '缺少 Supabase 設定:請在 .env.local(本機)或 GitHub Actions Variables(部署)設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY。',
      )
    }
    return new SupabaseChatService(getClientId(), url, key)
  }
  throw new Error(`不認得的聊天服務「${backend}」,VITE_CHAT_BACKEND 只能是 mock 或 supabase。`)
}
