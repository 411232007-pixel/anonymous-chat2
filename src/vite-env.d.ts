/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** mock = 假服務(階段一);supabase = 真服務(階段二) */
  readonly VITE_CHAT_BACKEND?: 'mock' | 'supabase'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
