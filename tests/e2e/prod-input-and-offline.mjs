import { chromium } from 'playwright-core'
const URL = 'https://411232007-pixel.github.io/anonymous-chat2/'
const results = []
const log = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tag = Math.random().toString(36).slice(2, 5)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const open = async (opts = {}) => { const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts }); const page = await context.newPage(); await page.goto(URL, { waitUntil: 'networkidle' }); return { context, page } }
const join = async (u, n) => { await u.page.fill('#nickname', n); await u.page.click('button[type=submit]'); await u.page.waitForSelector('.composer__input', { timeout: 20000 }) }
const has = (u, t) => u.page.evaluate((x) => document.querySelector('.list')?.innerText.includes(x), t)
const waitText = async (u, t, timeout = 15000) => { try { await u.page.waitForFunction((x) => document.querySelector('.list')?.innerText.includes(x), t, { timeout }); return true } catch { return false } }
try {
  const A = await open(); const B = await open()
  const nA = `丁${tag}`, nB = `戊${tag}`
  await join(A, nA); await join(B, nB); await sleep(2000)

  // 輸入框行為(電腦)
  await A.page.fill('.composer__input', '')
  const disabledEmpty = await A.page.$eval('.btn--send', (b) => b.disabled)
  log('空白訊息不能送(按鈕停用)', disabledEmpty)
  await A.page.fill('.composer__input', '   ')
  log('全空白也不能送', await A.page.$eval('.btn--send', (b) => b.disabled))
  await A.page.fill('.composer__input', '字'.repeat(501))
  const over = await A.page.evaluate(() => ({ dis: document.querySelector('.btn--send').disabled, counter: document.querySelector('.counter')?.innerText }))
  log('超過 500 字不能送並有提示', over.dis && /超過 1 字/.test(over.counter), JSON.stringify(over))
  await A.page.fill('.composer__input', '字'.repeat(460))
  const near = await A.page.evaluate(() => document.querySelector('.counter')?.innerText)
  log('接近上限出現字數提醒', /剩 40 字/.test(near ?? ''), near)
  await A.page.fill('.composer__input', '')
  // Shift+Enter 換行、Enter 送出
  await A.page.click('.composer__input')
  await A.page.keyboard.type(`[自動測試] ${tag} 第一行`)
  await A.page.keyboard.press('Shift+Enter')
  await A.page.keyboard.type('第二行')
  const val = await A.page.inputValue('.composer__input')
  log('Shift+Enter 換行(尚未送出)', val.includes('\n'))
  await A.page.keyboard.press('Enter')
  log('Enter 送出,對方收到且保留換行', await waitText(B, `${tag} 第一行`))
  const multi = await B.page.evaluate((t) => [...document.querySelectorAll('.bubble')].find((b) => b.innerText.includes(t))?.innerText, `${tag} 第一行`)
  log('換行被保留', /第一行\n+第二行/.test(multi ?? ''), JSON.stringify(multi))

  // 前端限速 UI:5 則後出現「送太快了」
  for (let i = 1; i <= 5; i++) { await A.page.fill('.composer__input', `[自動測試] ${tag} r${i}`); await A.page.click('.btn--send') }
  await A.page.fill('.composer__input', `[自動測試] ${tag} r6`)
  const dis6 = await A.page.$eval('.btn--send', (b) => b.disabled)
  await A.page.keyboard.press('Enter')
  await sleep(300)
  const hint = await A.page.evaluate(() => document.querySelector('.hint--warn')?.innerText ?? '')
  log('前端限速:第 6 則被擋並顯示「送太快了」與倒數', /送太快了/.test(hint) && /\d 秒/.test(hint), hint)
  await sleep(6000)
  const back = await A.page.$eval('.btn--send', (b) => b.disabled)
  log('限速時間到後恢復', back === false)
  await A.page.fill('.composer__input', '')

  // 「有新訊息 ↓」:B 往上捲,A 再送一則
  await B.page.evaluate(() => { const l = document.querySelector('.list'); l.scrollTop = 0 })
  await sleep(300)
  await A.page.fill('.composer__input', `[自動測試] ${tag} 新訊息按鈕`)
  await A.page.click('.btn--send')
  await sleep(2000)
  const btn = await B.page.$('.new-messages')
  log('往上看舊訊息時出現「有新訊息」,且沒被拉到底', !!btn)
  if (btn) await btn.click()
  // 捲動是平滑動畫,訊息越多越久,所以等它到底(最多 10 秒)
  let atBottom = false
  for (let i = 0; i < 40 && !atBottom; i++) {
    await sleep(250)
    atBottom = await B.page.evaluate(() => { const l = document.querySelector('.list'); return l.scrollHeight - l.scrollTop - l.clientHeight < 60 })
  }
  log('點「有新訊息」後回到最底並消失', atBottom && !(await B.page.$('.new-messages')))

  // 斷線重連:B 離線 → A 送訊息 → B 回線後補上
  await B.context.setOffline(true)
  let banner = false
  try { await B.page.waitForFunction(() => document.querySelector('.banner')?.innerText.includes('重新連線'), null, { timeout: 40000 }); banner = true } catch {}
  log('斷線:出現「重新連線中」', banner)
  const disabledOffline = await B.page.evaluate(() => ({ ta: document.querySelector('.composer__input').disabled, btn: document.querySelector('.btn--send').disabled }))
  log('斷線:輸入框與送出鈕停用(文字不會丟)', disabledOffline.ta && disabledOffline.btn, JSON.stringify(disabledOffline))
  const missed = `[自動測試] ${tag} 斷線期間`
  await A.page.fill('.composer__input', missed); await A.page.click('.btn--send')
  await sleep(1500)
  await B.context.setOffline(false)
  const caught = await waitText(B, missed, 45000)
  log('回線後補上錯過的訊息', caught)
  const cnt = await B.page.evaluate((t) => document.querySelector('.list').innerText.split(t).length - 1, missed)
  log('補訊息後沒有重複', cnt === 1, `${cnt} 次`)
  let bannerGone = false
  try { await B.page.waitForFunction(() => !document.querySelector('.banner'), null, { timeout: 20000 }); bannerGone = true } catch {}
  log('回線後提示消失', bannerGone)
  // 斷線較久時,對方先把我從名單移除,我重新登記後才會再出現,所以等它穩定(最多 15 秒)
  let namesA = []
  for (let i = 0; i < 60; i++) {
    namesA = await A.page.$$eval('.online .online-list__name', (e) => e.map((x) => x.textContent))
    if (namesA.includes(nB)) break
    await sleep(250)
  }
  log('回線後名單恢復,且沒有重複的人', namesA.filter((n) => n === nB).length === 1, namesA.join(','))

  // 深色 / 淺色
  for (const scheme of ['light', 'dark']) {
    const C = await open({ colorScheme: scheme, viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true })
    await join(C, `己${scheme[0]}${tag}`)
    const style = await C.page.evaluate(() => { const bg = getComputedStyle(document.body).backgroundColor; const ink = getComputedStyle(document.querySelector('.bubble') ?? document.body).color; return { bg, ink, over: document.documentElement.scrollWidth - innerWidth } })
    log(`${scheme} 模式可讀(背景/文字不同色)、無左右捲動`, style.bg !== style.ink && style.over <= 0, JSON.stringify(style))
    await C.page.screenshot({ path: `./${scheme}.png` })
    await C.context.close()
  }
  // 手機 Enter 換行(touch)
  const M = await open({ viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true })
  await join(M, `庚${tag}`)
  await M.page.click('.composer__input')
  await M.page.keyboard.type('abc'); await M.page.keyboard.press('Enter'); await M.page.keyboard.type('def')
  const mv = await M.page.inputValue('.composer__input')
  log('手機:Enter 是換行,不會送出', mv === 'abc\ndef', JSON.stringify(mv))
  await M.page.screenshot({ path: './mobile-chat.png' })
  await M.context.close()
} catch (e) { log('腳本', false, String(e).slice(0, 300)) } finally { await browser.close() }
console.log(`\n${results.filter(Boolean).length}/${results.length} 通過`)
