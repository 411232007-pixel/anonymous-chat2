import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockChatService } from '../src/chat/MockChatService'
import type { ChatEvents } from '../src/chat/types'

// 「正在輸入」:同一個瀏覽器的兩個分頁互相通知(階段二的服務用同樣的規則,只是走 Supabase Broadcast)。

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

describe('正在輸入', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function twoUsers() {
    const a = new MockChatService('a', { bots: false })
    const b = new MockChatService('b', { bots: false })
    const seen: Array<ChatEvents['typing:changed']> = []
    b.on('typing:changed', (e) => seen.push(e))
    a.join('甲')
    await vi.advanceTimersByTimeAsync(2000)
    b.join('乙')
    await vi.advanceTimersByTimeAsync(2000)
    return { a, b, seen }
  }

  it('對方輸入時收到通知;太快重複呼叫會被節流', async () => {
    const { a, b, seen } = await twoUsers()
    a.setTyping(true)
    a.setTyping(true)
    a.setTyping(true)
    await flush()
    expect(seen).toEqual([{ clientId: 'a', typing: true }])
    a.leave()
    b.leave()
  })

  it('停止輸入會立刻通知;沒在輸入時不會多送', async () => {
    const { a, b, seen } = await twoUsers()
    a.setTyping(false)
    await flush()
    expect(seen).toEqual([])
    a.setTyping(true)
    await flush()
    a.setTyping(false)
    await flush()
    expect(seen).toEqual([
      { clientId: 'a', typing: true },
      { clientId: 'a', typing: false },
    ])
    a.leave()
    b.leave()
  })

  it('對方沒再更新(例如關掉分頁)時,5 秒後自動清除', async () => {
    const { a, b, seen } = await twoUsers()
    a.setTyping(true)
    await flush()
    await vi.advanceTimersByTimeAsync(5100)
    expect(seen.at(-1)).toEqual({ clientId: 'a', typing: false })
    a.leave()
    b.leave()
  })
})
