/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** mock = 假服務(階段一);supabase = 真服務(階段二) */
  readonly VITE_CHAT_BACKEND?: 'mock' | 'supabase'
  /** 階段二:Supabase 的 Project URL(可公開) */
  readonly VITE_SUPABASE_URL?: string
  /** 階段二:Supabase 的 Publishable key(可公開;絕對不是 secret / service_role) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
