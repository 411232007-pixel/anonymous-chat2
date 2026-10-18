# 對正式網站的真實瀏覽器測試

用 Playwright 驅動電腦上已安裝的 Edge(不需要另外下載瀏覽器),同時開多個**獨立**的瀏覽器工作階段,
對 GitHub Pages 的正式網址做測試。這些腳本**不會**被 `npm test` 執行,也不是專案的相依套件。

```
npm i --no-save playwright-core
node tests/e2e/prod-flow.mjs                  # 進入、名單、雙向傳訊、純文字、搜尋、正在輸入、手機 360/390px、離開
node tests/e2e/prod-input-and-offline.mjs     # 輸入規則、前端限速、「有新訊息」、斷線重連、深色模式
node tests/e2e/prod-message-order.mjs         # 連續送出的訊息順序
```

- 預設測試 `https://411232007-pixel.github.io/anonymous-chat2/`,可用環境變數 `TARGET` 改成其他網址(`prod-flow.mjs`)。
- **會在正式聊天室留下少量訊息**,內容都以 `[自動測試]` 開頭(約 20 則),使用者無法刪除。
  要清掉,到 Supabase 後台 SQL Editor 執行:`delete from public.messages where content like '[自動測試]%';`
- 要測 Chrome 而不是 Edge,把腳本裡的 `channel: 'msedge'` 改成 `'chrome'`。
- 截圖輸出到 `./`(執行時所在的資料夾)。
