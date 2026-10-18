import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)))
const U = env.VITE_SUPABASE_URL, K = env.VITE_SUPABASE_PUBLISHABLE_KEY
const cid = 'ratetest-' + Math.random().toString(36).slice(2, 8)
const post = async (i) => {
  const r = await fetch(`${U}/rest/v1/messages`, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ client_id: cid, nickname: '限速測試', content: `[自動測試] 直接呼叫 API #${i}` }) })
  return { status: r.status, body: r.status >= 400 ? await r.json() : null }
}
const out = []
for (let i = 1; i <= 8; i++) { const r = await post(i); out.push(r); console.log(i, r.status, r.body ? `${r.body.message} (hint ${r.body.hint})` : 'ok') }
const ok = out.filter((r) => r.status < 300).length, blocked = out.filter((r) => r.body?.message === 'rate_limited').length
console.log(`同一個 client_id 連續 8 則:成功 ${ok},被擋 ${blocked}`)
// 換一個 client_id,但同一個 IP:應該仍可送(IP 上限 100/分)
const cid2 = 'ratetest-' + Math.random().toString(36).slice(2, 8)
const r2 = await fetch(`${U}/rest/v1/messages`, { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ client_id: cid2, nickname: '限速測試', content: '[自動測試] 換 client_id 後的正常請求' }) })
console.log('換 client_id 的正常請求:', r2.status)
console.log('等 11 秒後,原 client_id 再送一則…')
await new Promise((r) => setTimeout(r, 11000))
const r3 = await post(9)
console.log('等待後:', r3.status, r3.body?.message ?? 'ok')
