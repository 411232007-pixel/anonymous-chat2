# anonymous-chat2

不用登入的匿名聊天室。網頁放在 GitHub Pages,即時傳訊(階段二)用 Supabase。
設計與規格請看 `docs/`(開工前先讀 `docs/architecture.md` 和 `docs/design.md`)。

## 目前進度:階段一(只有前端,假服務)

聊天室裡的機器人和同瀏覽器分頁互傳都是假的,不同裝置之間不會真的連在一起。

## 指令

```
npm install      # 安裝套件(第一次)
npm run dev      # 本機預覽 http://localhost:5173/
npm test         # 單元測試
npm run build    # 建置(會先檢查型別)
```

## 測試用的網址參數

- `?debug`:出現測試面板(模擬斷線、下一則送出失敗)
- `?empty`:空聊天室(看「還沒有人說話」的畫面)

## 部署

推到 `main` 分支後,GitHub Actions 會自動測試、建置並發布到 GitHub Pages。
第一次要在 repo 的 Settings → Pages 把 Source 選成「GitHub Actions」。
