// 對正式網站做真實瀏覽器測試:兩個電腦版 + 一個手機版,各自獨立的工作階段。
// 只送少量帶 [自動測試] 前綴的訊息。
import { chromium } from 'playwright-core'

const URL = process.env.TARGET || 'https://411232007-pixel.github.io/anonymous-chat2/'
const results = []
const log = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tag = Math.random().toString(36).slice(2, 5)

const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function open(label, opts = {}) {
  const context = await browser.newContext(opts)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url().replace(/apikey=[^&]+/, 'apikey=…')}`))
  await page.goto(URL, { waitUntil: 'networkidle' })
  return { label, context, page, errors }
}

async function join(u, nick) {
  await u.page.fill('#nickname', nick)
  await u.page.click('button[type=submit]')
  await u.page.waitForSelector('.composer__input', { timeout: 20000 })
}

async function send(u, text) {
  await u.page.fill('.composer__input', text)
  await u.page.click('.btn--send')
}

async function waitText(u, text, timeout = 10000) {
  const t0 = Date.now()
  try {
    await u.page.waitForFunction((t) => document.querySelector('.list')?.innerText.includes(t), text, { timeout })
    return Date.now() - t0
  } catch {
    return -1
  }
}

const online = (u) => u.page.$$eval('.online .online-list__name', (els) => els.map((e) => e.textContent))

try {
  const A = await open('A', { viewport: { width: 1280, height: 800 } })
  const B = await open('B', { viewport: { width: 1280, height: 800 } })
  const nickA = `甲${tag}`
  const nickB = `乙${tag}`

  // ---- 進入 ----
  await join(A, nickA)
  await join(B, nickB)
  log('進入聊天室(電腦 A、B)', true)

  // 沒有機器人、沒有假歷史
  const namesA = await online(A)
  log('正式版不是假服務(名單沒有機器人)', !namesA.some((n) => ['夜貓', '小林', 'Ryo', '月光'].includes(n)), namesA.join(','))

  // ---- B2 名單 ----
  await sleep(2500)
  const bothA = await online(A)
  const bothB = await online(B)
  log('B2 名單:A 看得到 B', bothA.includes(nickB), bothA.join(','))
  log('B2 名單:B 看得到 A', bothB.includes(nickA), bothB.join(','))
  const joinedLine = await A.page.evaluate((n) => document.querySelector('.list')?.innerText.includes(n + ' 進來了'), nickB)
  log('B2 進入提示:A 看到「乙 進來了」', joinedLine === true)

  // ---- B1 雙向 ----
  const m1 = `[自動測試] ${tag} 甲→乙`
  await send(A, m1)
  const l1 = await waitText(B, m1)
  log('B1 A→B 收到(10 秒內)', l1 >= 0, l1 >= 0 ? `${l1}ms` : '逾時')
  const m2 = `[自動測試] ${tag} 乙→甲`
  await send(B, m2)
  const l2 = await waitText(A, m2)
  log('B1 B→A 收到(10 秒內)', l2 >= 0, l2 >= 0 ? `${l2}ms` : '逾時')
  const dup = await B.page.evaluate((t) => document.querySelector('.list').innerText.split(t).length - 1, m1)
  log('沒有重複訊息', dup === 1, `出現 ${dup} 次`)

  // ---- B3 純文字 ----
  const xss = `[自動測試] ${tag} <img src=x onerror="window.__xss=1"> <script>window.__xss=2</script>`
  await send(A, xss)
  await waitText(B, `[自動測試] ${tag} <img`)
  const safe = await B.page.evaluate(() => ({
    flag: window.__xss,
    imgs: document.querySelectorAll('.list img').length,
    scripts: document.querySelectorAll('.list script').length,
    text: document.querySelector('.list').innerText.includes('<img src=x'),
  }))
  log('B3 HTML 當純文字(B 端)', safe.flag === undefined && safe.imgs === 0 && safe.scripts === 0 && safe.text, JSON.stringify(safe))
  const safeA = await A.page.evaluate(() => ({ flag: window.__xss, imgs: document.querySelectorAll('.list img').length }))
  log('B3 HTML 當純文字(自己端)', safeA.flag === undefined && safeA.imgs === 0, JSON.stringify(safeA))

  // ---- 新增功能 B:正在輸入 ----
  await A.page.fill('.composer__input', '正在打字')
  const t0 = Date.now()
  let typingOk = false
  try {
    await B.page.waitForFunction((n) => document.querySelector('.typing')?.innerText.includes(n), nickA, { timeout: 6000 })
    typingOk = true
  } catch {}
  log('新增 B:B 看到「甲 正在輸入…」', typingOk, typingOk ? `${Date.now() - t0}ms` : '逾時')
  // 自己的畫面不顯示自己
  const selfTyping = await A.page.evaluate(() => document.querySelector('.typing')?.innerText ?? '')
  log('新增 B:自己的畫面不顯示自己在輸入', selfTyping === '', selfTyping)
  // 停止輸入(清空)後消失
  await A.page.fill('.composer__input', '')
  let cleared = false
  try {
    await B.page.waitForFunction(() => (document.querySelector('.typing')?.innerText ?? '') === '', null, { timeout: 6000 })
    cleared = true
  } catch {}
  log('新增 B:清空後提示消失', cleared)
  // 送出訊息後也會清除
  await A.page.fill('.composer__input', `[自動測試] ${tag} 送出後清除`)
  try {
    await B.page.waitForFunction((n) => document.querySelector('.typing')?.innerText.includes(n), nickA, { timeout: 6000 })
  } catch {}
  await A.page.click('.btn--send')
  let clearedBySend = false
  try {
    await B.page.waitForFunction(() => (document.querySelector('.typing')?.innerText ?? '') === '', null, { timeout: 6000 })
    clearedBySend = true
  } catch {}
  log('新增 B:送出訊息後提示消失', clearedBySend)

  // ---- 新增功能 A:搜尋 ----
  await B.page.click('button[aria-label="搜尋訊息"]')
  await B.page.fill('.searchbar__input', `${tag} 甲→乙`)
  await sleep(300)
  const s1 = await B.page.evaluate(() => ({
    status: document.querySelector('.searchbar__status')?.innerText,
    rows: document.querySelectorAll('.list .msg').length,
    marks: document.querySelectorAll('.list mark.hit').length,
  }))
  log('新增 A:搜尋找到訊息並高亮', s1.rows === 1 && s1.marks >= 1 && /找到 1 則/.test(s1.status), JSON.stringify(s1))
  await B.page.fill('.searchbar__input', 'zzzz-不存在-zzzz')
  await sleep(300)
  const s2 = await B.page.evaluate(() => document.querySelector('.list .empty__title')?.innerText)
  log('新增 A:無結果顯示提示', s2 === '沒有符合的訊息', s2)
  await B.page.fill('.searchbar__input', 'onerror')
  await sleep(300)
  const s3 = await B.page.evaluate(() => ({ imgs: document.querySelectorAll('.list img').length, flag: window.__xss }))
  log('新增 A:搜尋 HTML 字串仍是純文字', s3.imgs === 0 && s3.flag === undefined, JSON.stringify(s3))
  await B.page.click('button[aria-label="關閉搜尋"]')
  await sleep(300)
  const s4 = await B.page.evaluate(() => document.querySelectorAll('.list .msg').length)
  log('新增 A:關閉後恢復全部訊息', s4 >= 3, `${s4} 則`)

  // ---- 代號重複 ----
  const D = await open('D', { viewport: { width: 1280, height: 800 } })
  await D.page.fill('#nickname', nickA)
  await D.page.click('button[type=submit]')
  let taken = false
  try {
    await D.page.waitForSelector('.field__note--error', { timeout: 15000 })
    taken = (await D.page.innerText('.field__note--error')).includes('有人在用')
  } catch {}
  log('代號重複被拒絕', taken)
  await D.context.close()

  // ---- 手機版 360 / 390 ----
  for (const width of [360, 390]) {
    const C = await open(`C${width}`, {
      viewport: { width, height: 740 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    })
    const overflowJoin = await C.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    log(`B3 ${width}px 輸入代號畫面沒有左右捲動`, overflowJoin <= 0, `溢出 ${overflowJoin}px`)
    const nickC = `丙${width}${tag}`
    await join(C, nickC)
    const longUrl = `[自動測試] ${tag} https://example.com/${'a'.repeat(120)}`
    await send(C, longUrl)
    await waitText(C, `[自動測試] ${tag} https://example.com/`)
    const overflow = await C.page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      body: document.body.scrollWidth - window.innerWidth,
    }))
    log(`B3 ${width}px 聊天室(含長網址)沒有左右捲動`, overflow.over <= 0 && overflow.body <= 0, JSON.stringify(overflow))
    const box = await C.page.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect()
      const i = r('.composer__input'), b = r('.btn--send')
      return { inputOk: !!i && i.width > 120 && i.right <= innerWidth && i.bottom <= innerHeight, btn: !!b && b.height >= 40 && b.right <= innerWidth && b.bottom <= innerHeight }
    })
    log(`B3 ${width}px 輸入框與送出鈕可操作`, box.inputOk && box.btn, JSON.stringify(box))
    const seenByA = await waitText(A, `[自動測試] ${tag} https://example.com/`)
    log(`B1 手機(${width}px)→電腦 收到`, seenByA >= 0, seenByA >= 0 ? `${seenByA}ms` : '逾時')
    if (width === 360) {
      let names = []
      for (let i = 0; i < 40; i++) { names = await online(A); if (names.includes(nickC)) break; await sleep(250) }
      log('B2 電腦看得到手機使用者', names.includes(nickC), names.join(','))
      // 手機名單展開
      await C.page.click('.online-count--toggle')
      const pop = await C.page.evaluate(() => document.querySelector('.online-pop')?.innerText ?? '')
      log('B2 手機版點開名單看得到其他人', pop.includes(nickA) && pop.includes(nickB), pop.replace(/\n/g, ' '))
      await C.page.keyboard.press('Escape')
      // 關閉分頁 → 其他人看到離開
      await C.context.close()
      let left = -1
      const tl = Date.now()
      try {
        await A.page.waitForFunction((n) => document.querySelector('.list')?.innerText.includes(n + ' 離開了'), nickC, { timeout: 40000 })
        left = Date.now() - tl
      } catch {}
      log('B2 關閉分頁後,對方看到「離開了」', left >= 0, left >= 0 ? `${left}ms` : '逾時 40 秒')
      const after = await online(A)
      log('B2 離開後名單移除', !after.includes(nickC), after.join(','))
    } else {
      await C.context.close()
    }
  }

  // ---- 重新整理 ----
  await B.page.reload({ waitUntil: 'networkidle' })
  const pre = await B.page.inputValue('#nickname')
  log('重新整理後代號預先填入', pre === nickB, pre)
  await B.page.click('button[type=submit]')
  await B.page.waitForSelector('.composer__input', { timeout: 20000 })
  await sleep(2000)
  const hist = await B.page.evaluate((t) => document.querySelector('.list').innerText.includes(t), `[自動測試] ${tag} 甲→乙`)
  log('重新整理後歷史訊息還在,且沒有被當成代號重複', hist)

  const errs = [...A.errors, ...B.errors].filter((e) => !/favicon/i.test(e))
  log('頁面沒有主控台錯誤', errs.length === 0, errs.slice(0, 3).join(' | '))
} catch (error) {
  log('腳本執行', false, String(error).slice(0, 300))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通過`)
process.exit(failed.length ? 1 : 0)
