# 需求說明

## 這是什麼
一個不用登入的匿名聊天室。所有人在同一個聊天室裡。

## 誰會用
任何知道網站連結的人都可以進來用, 可以用電腦, 也可以用手機來操作。

## 使用的流程
1. 打開網頁
2. 輸入一個代號
3. 進入聊天室，看到其他人的訊息，也可以送出訊息
4. （其他你想到的）

## 畫面上要有
- 誰在線上
- 有人進來或離開時要有提示
- （其他你想要的）

## 不需要的
- 註冊、登入
- （其他你確定不要的）

## 技術上我知道的
- 網頁放在 GitHub Pages
- 即時傳訊用 Supabase，透過 WebSocket
- 畫面設計用 /design，前端用 /frontend-design 做出來

## 做事的順序
1. 先把前端做好，放上 GitHub Pages 看得到
2. 最後才接上 Supabase

## 我不知道、需要你幫我決定並解釋的
- 前端要用什麼語言和框架
- Supabase 要怎麼設定
- 金鑰怎麼產生、要放在哪裡

## 新增功能

除了上面的基本聊天室,另外做了三個功能(A、B、C 各一個)。細節、程式位置與限制見 `docs/architecture.md` 第 14 節;驗證結果見 `docs/grading-checklist.md`。

| 類別 | 功能 | 怎麼用 | 程式位置 |
|---|---|---|---|
| A:只在自己的畫面 | **搜尋訊息** | 聊天室頂部右側的放大鏡圖示 → 輸入關鍵字,只剩符合的訊息並標示符合的字;Esc 或 ✕ 離開 | `src/logic/search.ts`、`src/components/SearchBar/`、`src/components/MessageList/` |
| B:和所有人即時同步 | **正在輸入提示** | 一個人在輸入框打字,其他人的輸入框上方會出現「○○ 正在輸入…」;停止、送出、離開、斷線後消失 | `src/chat/SupabaseChatService.ts`、`src/hooks/useChat.ts`、`src/components/TypingIndicator/` |
| C:伺服器端強制的規則 | **資料庫發送頻率限制** | 不用操作。送太快時,資料庫會拒絕新增(連繞過網頁直接呼叫 API 也擋),畫面提示「送太快了…」 | `supabase/migrations/002_rate_limit.sql`、`supabase/tests/rate_limit_test.sql` |

C 類需要在 Supabase 後台的 SQL Editor 執行一次 `002_rate_limit.sql` 才會生效(不使用 Supabase CLI)。
