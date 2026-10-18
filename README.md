# anonymous-chat2

不用登入的匿名聊天室。網頁放在 GitHub Pages,即時傳訊(階段二)用 Supabase。
設計與規格請看 `docs/`(開工前先讀 `docs/architecture.md` 和 `docs/design.md`)。

## 目前進度:階段二(已接上 Supabase)

正式網站:https://411232007-pixel.github.io/anonymous-chat2/

不同裝置、不同人之間可以真的即時聊天(Supabase Realtime)。訊息會永久保存在資料庫,使用者無法刪除;代號可以被冒用(沒有登入的代價),詳見 `docs/architecture.md` 第 9.3 節。

階段一的假服務(機器人 + 同瀏覽器分頁互傳)仍保留,`VITE_CHAT_BACKEND=mock` 時使用。

## 新增功能

- **搜尋訊息**(A):頂部右側放大鏡。
- **正在輸入提示**(B):對方打字時,輸入框上方顯示「○○ 正在輸入…」。
- **伺服器端發送頻率限制**(C):資料庫觸發器擋下送太快的訊息,繞過網頁也擋;需在 Supabase SQL Editor 執行 `supabase/migrations/002_rate_limit.sql`。

操作方式、程式位置與限制見 `docs/requirements.md` 的「新增功能」與 `docs/architecture.md` 第 14 節。評分項目對照見 `docs/grading-checklist.md`。

## 指令

```
npm install      # 安裝套件(第一次)
npm run dev      # 本機預覽 http://localhost:5173/
npm test         # 單元測試
npm run build    # 建置(會先檢查型別)
```

## 測試用的網址參數

- 以下兩個只在假服務(`VITE_CHAT_BACKEND=mock`)下有作用:
  - `?debug`:出現測試面板(模擬斷線、下一則送出失敗)
  - `?empty`:空聊天室(看「還沒有人說話」的畫面)

## 設定 Supabase(階段二)

不使用 Supabase CLI。照 `supabase/setup.md` 在網頁後台執行 `supabase/migrations/` 裡的 SQL。
本機要連 Supabase,複製 `.env.example` 成 `.env.local` 並填入 Project URL 與 Publishable key(兩個都可以公開;`.env.local` 不會被 commit)。**不要**放 Secret key、`service_role` 或資料庫密碼。

## 部署

推到 `main` 分支後,GitHub Actions 會自動測試、建置並發布到 GitHub Pages。
第一次要在 repo 的 Settings → Pages 把 Source 選成「GitHub Actions」。
階段二另外要在 Settings → Secrets and variables → Actions → **Variables** 設定 `VITE_CHAT_BACKEND`(`supabase`)、`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`。

評分前請確認 Supabase 專案沒有被暫停(免費專案約一週沒有活動會自動暫停,到後台按 Restore 即可恢復)。
