import { chromium } from 'playwright-core'
const URL = 'https://411232007-pixel.github.io/anonymous-chat2/'
const tag = Math.random().toString(36).slice(2, 5)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const open = async () => { const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage(); await p.goto(URL, { waitUntil: 'networkidle' }); return p }
const join = async (p, n) => { await p.fill('#nickname', n); await p.click('button[type=submit]'); await p.waitForSelector('.composer__input') }
const A = await open(), B = await open()
await join(A, `辛${tag}`); await join(B, `壬${tag}`); await new Promise((r) => setTimeout(r, 2000))
for (let i = 1; i <= 5; i++) { await A.fill('.composer__input', `[自動測試] ${tag} o${i}`); await A.click('.btn--send') }
await new Promise((r) => setTimeout(r, 4000))
const order = (p) => p.evaluate((t) => [...document.querySelectorAll('.bubble')].map((b) => b.innerText).filter((x) => x.includes(t)).map((x) => x.split(' ').pop()), tag)
const a = await order(A), b = await order(B)
console.log('A sees', a.join(','), '| B sees', b.join(','))
const ok = JSON.stringify(a) === JSON.stringify(['o1', 'o2', 'o3', 'o4', 'o5']) && JSON.stringify(a) === JSON.stringify(b)
console.log(ok ? 'PASS 連續送出的順序正確且兩邊一致' : 'FAIL')
await browser.close()
