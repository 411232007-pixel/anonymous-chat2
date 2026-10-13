# CLAUDE.md

一個不用登入的匿名聊天室,前端放在 GitHub Pages,即時傳訊使用 Supabase。

- 開始任何工作前,先讀 `docs/architecture.md`。需求在 `docs/requirements.md`。
- 目前在「階段一」:只做前端,使用假服務(MockChatService),還不接 Supabase。
- 不可以把金鑰檔案(`.env`、`.env.local` 等)commit 進 git。只有 `.env.example` 可以提交,且不能有真實的值。
