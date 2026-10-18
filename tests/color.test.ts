import { describe, expect, it } from 'vitest'
import { USER_COLOR_COUNT, colorIndex } from '../src/logic/color'

describe('colorIndex', () => {
  it('同一個代號永遠得到同一個顏色', () => {
    expect(colorIndex('午夜雨')).toBe(colorIndex('午夜雨'))
  })

  it('全形半形、大小寫不影響顏色', () => {
    expect(colorIndex('Ming')).toBe(colorIndex('ＭＩＮＧ'))
  })

  it('永遠落在色票範圍內', () => {
    for (const name of ['a', '夜貓', '🌙', 'x'.repeat(12), '小林', 'Ryo']) {
      const index = colorIndex(name)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(USER_COLOR_COUNT)
    }
  })

  it('不同代號大致分散在不同顏色', () => {
    const used = new Set(Array.from({ length: 60 }, (_, i) => colorIndex(`使用者${i}`)))
    expect(used.size).toBeGreaterThanOrEqual(6)
  })
})
