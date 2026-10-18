-- 驗證伺服器端限速(貼到 SQL Editor 執行)。
-- 在一個交易裡連續新增 8 則,預期前 6 則通過、後 2 則被擋,最後一定「回復原狀」,
-- 所以不會在聊天室留下任何測試訊息,也不會留下 rate_log 紀錄。
--
-- 看到 ERROR: ROLLBACK_OK accepted=6 blocked=2 就是通過(這個 ERROR 是故意的,用來回復原狀)。
-- 看到 FAILED 開頭的錯誤就是沒通過,請把整段文字貼給維護者。

do $$
declare
  ok int := 0;
  blocked int := 0;
  i int;
begin
  for i in 1..8 loop
    begin
      insert into public.messages (client_id, nickname, content)
      values ('ratelimit-selftest', 'test', 'selftest ' || i);
      ok := ok + 1;
    exception when sqlstate 'P0001' then
      blocked := blocked + 1;
    end;
  end loop;

  if ok <> 6 or blocked <> 2 then
    raise exception 'FAILED accepted=% blocked=% (expected 6 and 2)', ok, blocked;
  end if;
  raise exception 'ROLLBACK_OK accepted=% blocked=%', ok, blocked;
end $$;
