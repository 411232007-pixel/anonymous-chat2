import { describe, expect, it } from 'vitest'
import { NICKNAME_MAX, normalizeNickname, validateNickname } from '../src/logic/nickname'

// 看不見的字元用數字產生,避免原始碼裡出現看不見的字
const ch = (codePoint: number) => String.fromCodePoint(codePoint)
const BELL = ch(0x07)
const ZERO_WIDTH_SPACE = ch(0x200b)
const RIGHT_TO_LEFT_OVERRIDE = ch(0x202e)
const ZERO_WIDTH_JOINER = ch(0x200d)

describe('validateNickname', () => {
  it('接受中文、英文、emoji', () => {
    expect(validateNickname('午夜雨')).toEqual({ ok: true, nickname: '午夜雨' })
    expect(validateNickname('Ryo')).toEqual({ ok: true, nickname: 'Ryo' })
    expect(validateNickname('🌙小夜')).toEqual({ ok: true, nickname: '🌙小夜' })
  })

  it('空白或全空格視為空', () => {
    expect(validateNickname('')).toEqual({ ok: false, error: 'empty' })
    expect(validateNickname('   ')).toEqual({ ok: false, error: 'empty' })
  })

  it('去掉前後空白、合併中間的連續空白', () => {
    expect(validateNickname('  a   b  ')).toEqual({ ok: true, nickname: 'a b' })
  })

  it('12 字通過,13 字被拒(emoji 算 1 個字)', () => {
    expect(validateNickname('一'.repeat(NICKNAME_MAX)).ok).toBe(true)
    expect(validateNickname('一'.repeat(NICKNAME_MAX + 1))).toEqual({ ok: false, error: 'too_long' })
    expect(validateNickname('🌙'.repeat(NICKNAME_MAX)).ok).toBe(true)
  })

  it('拒絕控制字元、零寬字元、方向控制字元', () => {
    expect(validateNickname(`a${BELL}b`)).toEqual({ ok: false, error: 'invalid_chars' })
    expect(validateNickname(`a${ZERO_WIDTH_SPACE}b`)).toEqual({ ok: false, error: 'invalid_chars' })
    expect(validateNickname(`a${RIGHT_TO_LEFT_OVERRIDE}b`)).toEqual({ ok: false, error: 'invalid_chars' })
  })

  it('看起來是空白的代號被拒絕', () => {
    expect(validateNickname(ZERO_WIDTH_JOINER)).toEqual({ ok: false, error: 'empty' })
  })

  it('保留 emoji 組合需要的零寬連接符', () => {
    const family = `👨${ZERO_WIDTH_JOINER}👩`
    expect(validateNickname(family)).toEqual({ ok: true, nickname: family })
  })
})

describe('normalizeNickname', () => {
  it('全形半形、大小寫、空白視為相同', () => {
    expect(normalizeNickname('Ming')).toBe(normalizeNickname('ＭＩＮＧ'))
    expect(normalizeNickname('a  b')).toBe(normalizeNickname('A B'))
  })

  it('不同的代號不會被當成相同', () => {
    expect(normalizeNickname('夜貓')).not.toBe(normalizeNickname('夜貓2'))
  })
})
