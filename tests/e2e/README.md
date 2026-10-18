# 對正式網站的真實瀏覽器測試

用 Playwright 驅動電腦上已安裝的 Edge(不需要另外下載瀏覽器),同時開多個**獨立**的瀏覽器工作階段,
對 GitHub Pages 的正式網址做測試。這些腳本**不會**被 `npm test` 執行,也不是專案的相依套件。

```
npm i --no-save playwright-core
node tests/e2e/prod-flow.mjs                  # 進入、名單、雙向傳訊、純文字、搜尋、正在輸入、手機 360/390px、離開
node tests/e2e/prod-input-and-offline.mjs     # 輸入規則、前端限速、「有新訊息」、斷線重連、深色模式
node tests/e2e/prod-message-order.mjs         # 連續送出的訊息順序
node tests/e2e/prod-rate-limit-rest.mjs       # 繞過網頁、直接呼叫 REST API 連續新增:第 7 則起被資料庫擋下(需要本機 .env.local;要先套用 002_rate_limit.sql)
node tests/e2e/prod-rate-limit-ui.mjs         # 額度被用完後從網頁送出:顯示「送太快了」並把文字放回輸入框(同上)
```

- 預設測試 `https://411232007-pixel.github.io/anonymous-chat2/`,可用環境變數 `TARGET` 改成其他網址(`prod-flow.mjs`)。
- **會在正式聊天室留下少量訊息**,內容都以 `[自動測試]` 開頭(每次完整跑一輪約 20~30 則),使用者無法刪除。
  要清掉,到 Supabase 後台 SQL Editor 執行:`delete from public.messages where content like '[自動測試]%';`
- 要測 Chrome 而不是 Edge,把腳本裡的 `channel: 'msedge'` 改成 `'chrome'`。
- 截圖輸出到 `./`(執行時所在的資料夾)。
