-- 匿名聊天室:Supabase 資料表與權限規則(整個檔案貼到 SQL Editor 執行)
-- 可以重複執行,不會出錯,也不會刪掉已有的訊息。

-- 訊息資料表
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  client_id  text        not null check (char_length(client_id) between 1 and 64),
  nickname   text        not null check (char_length(nickname) between 1 and 12
                                         and btrim(nickname) <> ''),
  content    text        not null check (char_length(content) between 1 and 500
                                         and btrim(content, E' \t\r\n') <> ''),
  created_at timestamptz not null default now()
);

-- 打開 RLS(列級安全規則):沒有規則允許的事,一律不能做
alter table public.messages enable row level security;

-- 訪客只能讀取和新增,沒有修改、刪除的規則
drop policy if exists "anyone can read messages" on public.messages;
create policy "anyone can read messages"
  on public.messages for select to anon using (true);

drop policy if exists "anyone can add messages" on public.messages;
create policy "anyone can add messages"
  on public.messages for insert to anon with check (true);

-- 再加一層保險:資料表權限也收回,只開放需要的
revoke all on public.messages from anon, authenticated;
grant select on public.messages to anon;
grant insert (client_id, nickname, content) on public.messages to anon;

-- 新增訊息時,即時通知所有在線的人
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
