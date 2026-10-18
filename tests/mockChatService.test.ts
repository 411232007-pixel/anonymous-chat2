import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockChatService } from '../src/chat/MockChatService'
import type { ChatEventName, ChatEvents } from '../src/chat/types'

// 假服務要「說和真服務一樣的話」:事件名稱、資料格式、順序都照 docs/architecture.md 第 5 節。

function record(service: MockChatService) {
  const log: Array<{ event: ChatEventName; payload: unknown }> = []
  const names: ChatEventName[] = [
    'connection:status',
    'join:accepted',
    'join:rejected',
    'history:loaded',
    'message:new',
    'message:failed',
    'presence:sync',
    'presence:joined',
    'presence:left',
    'typing:changed',
  ]
  for (const event of names) {
    service.on(event, (payload: ChatEvents[typeof event]) => log.push({ event, payload }))
  }
  return log
}

const events = (log: ReturnType<typeof record>) => log.map((entry) => entry.event)

describe('MockChatService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('加入成功:依序發出 connecting → connected → join:accepted → history:loaded', () => {
    const service = new MockChatService('me', { bots: true })
    const log = record(service)
    service.join('午夜雨')
    vi.advanceTimersByTime(2000)

    expect(events(log)).toEqual([
      'connection:status',
      'connection:status',
      'join:accepted',
      'history:loaded',
    ])
    expect(log[0].payload).toBe('connecting')
    expect(log[1].payload).toBe('connected')

    const accepted = log[2].payload as ChatEvents['join:accepted']
    expect(accepted.users[0]).toMatchObject({ clientId: 'me', nickname: '午夜雨' })
    expect(accepted.users.map((u) => u.nickname)).toEqual(expect.arrayContaining(['夜貓', '小林']))
    service.leave()
  })

  it('歷史訊息最多 50 則,由舊到新', () => {
    const service = new MockChatService('me')
    const log = record(service)
    service.join('午夜雨')
    vi.advanceTimersByTime(2000)

    const history = log.find((e) => e.event === 'history:loaded')?.payload as ChatEvents['history:loaded']
    expect(history.length).toBeGreaterThan(0)
    expect(history.length).toBeLessThanOrEqual(50)
    const ids = history.map((m) => m.id)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    service.leave()
  })

  it('代號和線上的人重複(全形半形、大小寫也算)會被拒絕', () => {
    const service = new MockChatService('me')
    const log = record(service)
    service.join('ＲＹＯ')
    vi.advanceTimersByTime(2000)

    expect(events(log)).toContain('join:rejected')
    expect(events(log)).not.toContain('join:accepted')
    expect(log.find((e) => e.event === 'join:rejected')?.payload).toEqual({ reason: 'nickname_taken' })
  })

  it('被拒絕後可以換一個代號再加入', () => {
    const service = new MockChatService('me')
    const log = record(service)
    service.join('夜貓')
    vi.advanceTimersByTime(2000)
    service.join('新來的')
    vi.advanceTimersByTime(2000)

    expect(events(log)).toContain('join:rejected')
    expect(events(log)).toContain('join:accepted')
    service.leave()
  })

  it('送出訊息後發出 message:new,內容與代號正確', () => {
    const service = new MockChatService('me', { bots: false })
    const log = record(service)
    service.join('午夜雨')
    vi.advanceTimersByTime(2000)
    service.sendMessage('你好')
    vi.advanceTimersByTime(500)

    const sent = log.filter((e) => e.event === 'message:new').map((e) => e.payload as ChatEvents['message:new'])
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ clientId: 'me', nickname: '午夜雨', content: '你好' })
    expect(Number.isNaN(Date.parse(sent[0].createdAt))).toBe(false)
    service.leave()
  })

  it('訊息編號嚴格遞增', () => {
    const service = new MockChatService('me', { bots: false })
    const log = record(service)
    service.join('午夜雨')
    vi.advanceTimersByTime(2000)
    for (const text of ['一', '二', '三']) {
      service.sendMessage(text)
      vi.advanceTimersByTime(300)
    }
    const ids = log.filter((e) => e.event === 'message:new').map((e) => (e.payload as ChatEvents['message:new']).id)
    expect(ids).toHaveLength(3)
    expect(ids[0]).toBeLessThan(ids[1])
    expect(ids[1]).toBeLessThan(ids[2])
    service.leave()
  })

  it('下一則設定為失敗時,發出 message:failed 並帶回原文', () => {
    const service = new MockChatService('me', { bots: false })
    const log = record(service)
    service.join('午夜雨')
    vi.advanceTimersByTime(2000)
    service.debug.failNextSend()
    service.sendMessage('這則會失敗')
    vi.advanceTimersByTime(500)

    expect(log.find((e) => e.event === 'message:failed')?.payload).toMatchObject({ content: '這則會失敗' })
    expect(events(log)).not.toContain('message:new')
    service.leave()
  })

  it('斷線:發出 reconnecting,送出會失敗;恢復後發出 connected', () => {
    const service = new MockChatService('me', { bots: false })
    const log = record(service)
    service.join('午夜雨')
    vi.advanceTimersByTime(2000)

    service.debug.setOffline(true)
    expect(log.at(-1)).toEqual({ event: 'connection:status', payload: 'reconnecting' })

    service.sendMessage('斷線中')
    vi.advanceTimersByTime(500)
    expect(log.find((e) => e.event === 'message:failed')?.payload).toMatchObject({ reason: 'offline' })

    service.debug.setOffline(false)
    vi.advanceTimersByTime(2000)
    expect(log.at(-1)).toEqual({ event: 'connection:status', payload: 'connected' })
    service.leave()
  })

  it('斷線期間機器人說的話,恢復連線後會補上', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // 讓機器人每次都「說話」
    const service = new MockChatService('me')
    const log = record(service)
    service.join('午夜雨')
    vi.advanceTimersByTime(2000)

    service.debug.setOffline(true)
    const before = log.filter((e) => e.event === 'message:new').length
    vi.advanceTimersByTime(30_000)
    expect(log.filter((e) => e.event === 'message:new').length).toBe(before) // 斷線中不顯示

    service.debug.setOffline(false)
    vi.advanceTimersByTime(2000)
    expect(log.filter((e) => e.event === 'message:new').length).toBeGreaterThan(before) // 補上了
    service.leave()
    vi.restoreAllMocks()
  })
})
