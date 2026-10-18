import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages 的網址是 https://<帳號>.github.io/<repo 名稱>/,
// 所以建置出來的網頁必須知道這段「基底路徑」,否則會找不到自己的 CSS 和 JS。
// 本機開發(vite dev)用根路徑;建置時用 VITE_BASE,沒設定就用 repo 名稱。
const REPO_BASE = '/anonymous-chat2/'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : (process.env.VITE_BASE ?? REPO_BASE),
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
}))
