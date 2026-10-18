# Supabase 設定(階段二)

這份文件記錄在 Supabase 後台要做的設定。對應 `docs/architecture.md` 第 3.2、5.4、8 節。
不使用 Supabase CLI,全部在網頁後台完成。

## 1. 建立專案

在 supabase.com 建立免費專案(Region 選 Singapore 或 Tokyo)。資料庫密碼自己保管,**不要放進專案**。

## 2. 建立資料表和權限規則

左側選 **SQL Editor** → **New query** → 貼上 `supabase/setup.sql` 的**整個檔案內容** → **Run**。
(只貼 SQL,不要貼到 `#` 開頭的標題行,否則會出現 syntax error。)
可以重複執行,不會出錯,也不會刪掉已有的訊息。下面是同一份 SQL,方便閱讀。

```sql
-- 訊息資料表
create table if not exists public.messages (
  id         bigint generated always as identity primary key,  -- 嚴格遞增,由資料庫給
  client_id  text        not null check (char_length(client_id) between 1 and 64),
  nickname   text        not null check (char_length(nickname) between 1 and 12
                                         and btrim(nickname) <> ''),
  content    text        not null check (char_length(content) between 1 and 500
                                         and btrim(content, E' \t\r\n') <> ''),
  created_at timestamptz not null default now()                -- 由資料庫決定,不信任手機時鐘
);

-- 打開 RLS(列級安全規則):沒有規則允許的事,一律不能做
alter table public.messages enable row level security;

-- 訪客只能「讀取」和「新增」,沒有修改、刪除的規則
drop policy if exists "anyone can read messages" on public.messages;
create policy "anyone can read messages"
  on public.messages for select to anon using (true);

drop policy if exists "anyone can add messages" on public.messages;
create policy "anyone can add messages"
  on public.messages for insert to anon with check (true);

-- 再加一層保險:連資料表權限都收回,只開放需要的
revoke all on public.messages from anon, authenticated;
grant select on public.messages to anon;
grant insert (client_id, nickname, content) on public.messages to anon;  -- 不能自己填 id 和時間

-- 新增訊息時,即時通知所有在線的人(Realtime 的 Postgres Changes)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
```

## 3. 白話說明

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
