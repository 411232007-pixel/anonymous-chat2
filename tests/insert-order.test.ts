import { describe, expect, it } from 'vitest'
import { insertByMessageId, type TimelineItem } from '../src/hooks/useChat'

const msg = (id: number): TimelineItem => ({
  key: `m-${id}`,
  kind: 'message',
  message: { id, clientId: 'c', nickname: 'n', content: String(id), createdAt: '2026-01-01T00:00:00Z' },
})
const sys = (key: string): TimelineItem => ({ key, kind: 'system', text: key })
const keys = (items: TimelineItem[]) => items.map((i) => i.key)

describe('insertByMessageId', () => {
  it('編號比較大的直接放最後', () => {
    expect(keys(insertByMessageId([msg(1), msg(2)], msg(3)))).toEqual(['m-1', 'm-2', 'm-3'])
  })

  it('晚到但編號較小的訊息,放回正確位置(每個人看到的順序一致)', () => {
    expect(keys(insertByMessageId([msg(1), msg(3), msg(4)], msg(2)))).toEqual(['m-1', 'm-2', 'm-3', 'm-4'])
  })

  it('系統提示行不影響排序,也不被移動', () => {
    const items = [msg(1), sys('s-1'), msg(5)]
    expect(keys(insertByMessageId(items, msg(3)))).toEqual(['m-1', 's-1', 'm-3', 'm-5'])
  })

  it('系統提示行直接放最後', () => {
    expect(keys(insertByMessageId([msg(1)], sys('s-2')))).toEqual(['m-1', 's-2'])
  })
})
