import fs from 'node:fs'
import { chromium } from 'playwright-core'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)))
const U = env.VITE_SUPABASE_URL, K = env.VITE_SUPABASE_PUBLISHABLE_KEY
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const p = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
await p.goto('https://411232007-pixel.github.io/anonymous-chat2/', { waitUntil: 'networkidle' })
const tag = Math.random().toString(36).slice(2, 5)
await p.fill('#nickname', `限${tag}`); await p.click('button[type=submit]'); await p.waitForSelector('.composer__input')
const cid = await p.evaluate(() => sessionStorage.getItem('anon-chat:client-id'))
// 繞過網頁:用這個瀏覽器的 client_id 直接連送 6 則,把額度用完
for (let i = 1; i <= 6; i++) await fetch(`${U}/rest/v1/messages`, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ client_id: cid, nickname: `限${tag}`, content: `[自動測試] 用完額度 ${tag} #${i}` }) })
// 現在從網頁送一則,網頁自己的限速還沒觸發,但伺服器會擋
const text = `[自動測試] 這則會被伺服器擋 ${tag}`
await p.fill('.composer__input', text); await p.click('.btn--send')
await p.waitForSelector('.hint--error', { timeout: 15000 })
const hint = await p.innerText('.hint--error')
const draft = await p.inputValue('.composer__input')
const shown = await p.evaluate((t) => document.querySelector('.list').innerText.includes(t), text)
console.log('提示文字:', hint)
console.log('文字回到輸入框:', draft === text)
console.log('訊息沒有出現在聊天室:', !shown)
await new Promise((r) => setTimeout(r, 11000))
await p.click('.btn--send')
await p.waitForFunction((t) => document.querySelector('.list').innerText.includes(t), text, { timeout: 15000 })
console.log('等 10 秒後重送成功')
await browser.close()
