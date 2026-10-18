-- 伺服器端強制的發送頻率限制(新增功能 C)
-- 貼到 Supabase 後台 SQL Editor 執行。可以重複執行,不會刪掉訊息。需要先執行過 001_messages.sql。
--
-- 做法:在 messages 資料表加一個 BEFORE INSERT 觸發器(trigger)。
-- 不管訊息是從網頁送出、還是有人繞過網頁直接呼叫 Supabase 的 API,
-- 只要是新增一列到 messages,就一定會先經過這個檢查,超過限制就整筆被拒絕。
--
-- 限制內容(同一個 client_id):
--   - 10 秒內最多 6 則(網頁端是 5 則,留一點空間給網路延遲)
--   - 60 秒內最多 40 則
-- 限制內容(同一個來源 IP,盡力而為):
--   - 60 秒內最多 100 則(教室、公司共用同一個 IP 時不至於誤擋)
--
-- 匿名的限制:沒有登入,client_id 是瀏覽器自己填的,可以隨便換。
-- 所以另外加上「來源 IP」這一層,擋住「不斷換 client_id」的洗版。
-- IP 只存成雜湊值、只存 10 分鐘,而且放在訪客完全讀不到的資料表。
-- 這仍然不是完美防護:換 IP(例如 VPN)的人擋不住。

-- 紀錄表:訪客看不到、也寫不進去(RLS 開著而且沒有任何規則,權限也全部收回)
create table if not exists public.rate_log (
  id        bigint generated always as identity primary key,
  client_id text        not null,
  ip_hash   text,
  at        timestamptz not null default clock_timestamp()
);

create index if not exists rate_log_client_at on public.rate_log (client_id, at desc);
create index if not exists rate_log_ip_at     on public.rate_log (ip_hash, at desc);
create index if not exists rate_log_at        on public.rate_log (at);

alter table public.rate_log enable row level security;
revoke all on public.rate_log from anon, authenticated;

-- 檢查函式。用資料表擁有者的身分執行,所以訪客不需要任何 rate_log 的權限。
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  headers json;
  ip      text;
  ip_key  text;
  n       integer;
begin
  -- 取得來源 IP。優先用 Cloudflare 填的欄位(使用者無法偽造),
  -- 沒有的話用 x-real-ip,最後才用 x-forwarded-for 的最後一段。
  begin
    headers := current_setting('request.headers', true)::json;
  exception when others then
    headers := null;
  end;

  ip := nullif(btrim(coalesce(
    headers->>'cf-connecting-ip',
    headers->>'x-real-ip',
    (string_to_array(coalesce(headers->>'x-forwarded-for', ''), ','))[
      array_length(string_to_array(coalesce(headers->>'x-forwarded-for', ''), ','), 1)
    ]
  )), '');
  ip_key := case when ip is null then null else md5(ip) end;

  -- 只留最近 10 分鐘的紀錄
  delete from public.rate_log where at < clock_timestamp() - interval '10 minutes';

  select count(*) into n from public.rate_log
   where client_id = new.client_id and at > clock_timestamp() - interval '10 seconds';
  if n >= 6 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = '10';
  end if;

  select count(*) into n from public.rate_log
   where client_id = new.client_id and at > clock_timestamp() - interval '60 seconds';
  if n >= 40 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = '60';
  end if;

  if ip_key is not null then
    select count(*) into n from public.rate_log
     where ip_hash = ip_key and at > clock_timestamp() - interval '60 seconds';
    if n >= 100 then
      raise exception 'rate_limited' using errcode = 'P0001', hint = '60';
    end if;
  end if;

  -- 通過了,記一筆(如果這筆訊息稍後因為其他規則被拒絕,這筆紀錄會一起撤銷)
  insert into public.rate_log (client_id, ip_hash) values (new.client_id, ip_key);
  return new;
end;
$$;

-- 這個函式只給觸發器用,不開放任何人直接呼叫
revoke all on function public.enforce_message_rate_limit() from public, anon, authenticated;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_rate_limit();
