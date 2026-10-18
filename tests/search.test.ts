import { describe, expect, it } from 'vitest'
import { SEARCH_MAX, cleanQuery, matchesQuery, splitByQuery } from '../src/logic/search'

describe('cleanQuery', () => {
  it('去掉前後空白;全空白視為沒有搜尋', () => {
    expect(cleanQuery('  月亮  ')).toBe('月亮')
    expect(cleanQuery('   ')).toBe('')
  })

  it('最多 50 個字', () => {
    expect(Array.from(cleanQuery('字'.repeat(SEARCH_MAX + 10))).length).toBe(SEARCH_MAX)
  })
})

describe('matchesQuery', () => {
  it('沒有搜尋字時全部符合', () => {
    expect(matchesQuery(['任何內容'], '')).toBe(true)
  })

  it('不分大小寫,內容或代號任一符合即可', () => {
    expect(matchesQuery(['Hello World', 'Ryo'], 'hello')).toBe(true)
    expect(matchesQuery(['你好', '夜貓'], '夜')).toBe(true)
    expect(matchesQuery(['你好', '夜貓'], '月亮')).toBe(false)
  })

  it('搜尋字當純文字,不是規則運算式', () => {
    expect(matchesQuery(['a+b'], 'a+b')).toBe(true)
    expect(matchesQuery(['aab'], 'a+b')).toBe(false)
    expect(matchesQuery(['(abc)'], '(')).toBe(true)
    expect(() => matchesQuery(['x'], '[')).not.toThrow()
  })
})

describe('splitByQuery', () => {
  it('切出符合的片段,串回去等於原文', () => {
    const pieces = splitByQuery('今天的月亮很亮,月亮真美', '月亮')
    expect(pieces.filter((p) => p.match).map((p) => p.text)).toEqual(['月亮', '月亮'])
    expect(pieces.map((p) => p.text).join('')).toBe('今天的月亮很亮,月亮真美')
  })

  it('保留原本的大小寫', () => {
    expect(splitByQuery('Hello', 'hello')).toEqual([{ text: 'Hello', match: true }])
  })

  it('網頁語法只是普通文字,原樣保留', () => {
    const text = '<img src=x onerror=alert(1)>'
    const pieces = splitByQuery(text, 'onerror')
    expect(pieces.map((p) => p.text).join('')).toBe(text)
    expect(pieces.find((p) => p.match)?.text).toBe('onerror')
  })

  it('沒有搜尋字或沒有符合時,回傳整段原文', () => {
    expect(splitByQuery('abc', '')).toEqual([{ text: 'abc', match: false }])
    expect(splitByQuery('abc', 'z')).toEqual([{ text: 'abc', match: false }])
  })
})
