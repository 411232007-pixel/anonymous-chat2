import { describe, expect, it } from 'vitest'
import { typingLabel } from '../src/logic/typing'

describe('typingLabel', () => {
  it('沒有人在輸入時是空字串', () => {
    expect(typingLabel([])).toBe('')
  })

  it('一人、兩人列出代號,三人以上改成「多人」', () => {
    expect(typingLabel(['夜貓'])).toBe('夜貓 正在輸入…')
    expect(typingLabel(['夜貓', '小林'])).toBe('夜貓、小林 正在輸入…')
    expect(typingLabel(['a', 'b', 'c'])).toBe('多人正在輸入…')
  })
})
