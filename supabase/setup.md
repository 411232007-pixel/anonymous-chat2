# Supabase 設定(階段二)

這份文件記錄在 Supabase 後台要做的設定。對應 `docs/architecture.md` 第 3.2、5.4、8 節。
不使用 Supabase CLI,全部在網頁後台完成。

## 1. 建立專案

在 supabase.com 建立免費專案(Region 選 Singapore 或 Tokyo)。資料庫密碼自己保管,**不要放進專案**。

## 2. 執行 SQL(依序)

左側選 **SQL Editor** → **New query**,**只貼 SQL 檔的整個內容**(不要貼到 `#` 開頭的標題行,否則會出現 syntax error)→ **Run**。
每個檔案都可以重複執行,不會出錯,也不會刪掉已有的訊息。

| 順序 | 檔案 | 做什麼 |
|---|---|---|
| 1 | `supabase/migrations/001_messages.sql` | 建立訊息資料表、權限規則(RLS)、即時通知 |
| 2 | `supabase/migrations/002_rate_limit.sql` | 伺服器端發送頻率限制(新增功能 C) |
| 3(驗證) | `supabase/tests/rate_limit_test.sql` | 驗證限速。看到 `ROLLBACK_OK accepted=6 blocked=2` 就通過;這個錯誤是故意的,用來回復原狀,不會留下任何資料 |

限速的白話說明:同一個 `client_id` 10 秒內最多 6 則、60 秒內最多 40 則;同一個來源 IP 60 秒內最多 100 則。超過就整筆新增被資料庫拒絕。IP 只存成雜湊值、只保留 10 分鐘,放在訪客讀不到的 `rate_log` 資料表。完整說明見 `docs/architecture.md` 第 14.3 節。

## 3. 白話說明(基本權限)

- **只能讀、只能新增**:沒有修改、刪除的規則,而且資料表權限也收回了。
- **訪客只能填三欄**:`client_id`、`nickname`、`content`。編號和時間由資料庫自己決定。
- **資料庫會擋**:空白內容、超過 500 字的內容、超過 12 字的代號。
- **看不到的事**:資料庫無法確認訊息真的是這個代號的人送的(沒有登入的代價,見架構文件 9.1)。

## 4. 前端要用的兩個值

**Project Settings → API Keys**,複製:
- **Project URL**(`https://xxxx.supabase.co`)
- **Publishable key**(`sb_publishable_` 開頭)

這兩個可以公開。**Secret key、`service_role`、資料庫密碼不要複製,也不要放進專案。**

放法見架構文件第 8.3 節:本機放 `.env.local`(不會被 commit),GitHub 放 Actions 的 Variables。
