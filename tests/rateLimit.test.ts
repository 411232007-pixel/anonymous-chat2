import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../src/logic/rateLimit'

const options = { max: 5, windowMs: 10_000, lockMs: 5_000 }

describe('createRateLimiter', () => {
  it('限制內可以送出', () => {
    const limiter = createRateLimiter(options)
    for (let i = 0; i < 5; i++) expect(limiter.tryConsume(1000 + i).ok).toBe(true)
  })

  it('第 6 則被擋,並鎖住一段時間', () => {
    const limiter = createRateLimiter(options)
    for (let i = 0; i < 5; i++) limiter.tryConsume(1000 + i)
    expect(limiter.tryConsume(1100)).toEqual({ ok: false, retryAfterMs: 5000 })
    expect(limiter.tryConsume(3000)).toEqual({ ok: false, retryAfterMs: 3100 })
  })

  it('鎖定時間過了就恢復', () => {
    const limiter = createRateLimiter(options)
    for (let i = 0; i < 5; i++) limiter.tryConsume(1000 + i)
    limiter.tryConsume(1100)
    expect(limiter.tryConsume(6200).ok).toBe(true)
  })

  it('慢慢送不會被擋', () => {
    const limiter = createRateLimiter(options)
    for (let i = 0; i < 20; i++) expect(limiter.tryConsume(i * 3000).ok).toBe(true)
  })
})
