# CLAUDE.md

一個不用登入的匿名聊天室,前端放在 GitHub Pages,即時傳訊使用 Supabase。

- 開始任何工作前,先讀 `docs/architecture.md`。需求在 `docs/requirements.md`。
- 做前端畫面前,也要讀 `docs/design.md`(顏色、字體、版面、元件與提示文字)。
- 目前在「階段二」:前端已接上 Supabase(SupabaseChatService)。假服務 MockChatService 保留,`VITE_CHAT_BACKEND=mock` 時使用。Supabase 的設定在 `supabase/`,不使用 Supabase CLI。
- 不可以把金鑰檔案(`.env`、`.env.local` 等)commit 進 git。只有 `.env.example` 可以提交,且不能有真實的值。
