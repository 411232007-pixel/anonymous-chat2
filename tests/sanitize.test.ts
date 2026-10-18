import { describe, expect, it } from 'vitest'
import { MESSAGE_MAX, cleanMessage, remainingChars, validateMessage } from '../src/logic/sanitize'

// 看不見的字元用數字產生,避免原始碼裡出現看不見的字
const ch = (codePoint: number) => String.fromCodePoint(codePoint)
const BELL = ch(0x07)
const ZERO_WIDTH_SPACE = ch(0x200b)
const RIGHT_TO_LEFT_OVERRIDE = ch(0x202e)
const ZERO_WIDTH_JOINER = ch(0x200d)

describe('validateMessage', () => {
  it('空白訊息被拒', () => {
    expect(validateMessage('')).toEqual({ ok: false, error: 'empty' })
    expect(validateMessage(' \n \t ')).toEqual({ ok: false, error: 'empty' })
  })

  it('只有看不見的字元也算空', () => {
    expect(validateMessage(`${ZERO_WIDTH_SPACE}${BELL}`)).toEqual({ ok: false, error: 'empty' })
  })

  it('500 字通過,501 字被拒', () => {
    expect(validateMessage('字'.repeat(MESSAGE_MAX)).ok).toBe(true)
    expect(validateMessage('字'.repeat(MESSAGE_MAX + 1))).toEqual({ ok: false, error: 'too_long' })
  })

  it('用「字」計算,不是位元組', () => {
    expect(validateMessage('😀'.repeat(MESSAGE_MAX)).ok).toBe(true)
  })

  it('保留網頁語法的原文,不做轉換(顯示時才一律當純文字)', () => {
    expect(validateMessage('<script>alert(1)</script>')).toEqual({
      ok: true,
      content: '<script>alert(1)</script>',
    })
  })
})

describe('cleanMessage', () => {
  it('去掉前後空白,統一換行', () => {
    expect(cleanMessage('  hi\r\nthere  ')).toBe('hi\nthere')
  })

  it('移除控制字元、零寬字元、方向控制字元', () => {
    expect(cleanMessage(`a${BELL}b${ZERO_WIDTH_SPACE}c${RIGHT_TO_LEFT_OVERRIDE}d`)).toBe('abcd')
  })

  it('保留 emoji 組合需要的零寬連接符', () => {
    const family = `👨${ZERO_WIDTH_JOINER}👩`
    expect(cleanMessage(family)).toBe(family)
  })

  it('連續空行最多留一行', () => {
    expect(cleanMessage('a\n\n\n\n\nb')).toBe('a\n\nb')
  })
})

describe('remainingChars', () => {
  it('回傳還能打幾個字,超過時是負數', () => {
    expect(remainingChars('')).toBe(MESSAGE_MAX)
    expect(remainingChars('字'.repeat(MESSAGE_MAX + 3))).toBe(-3)
  })
})
