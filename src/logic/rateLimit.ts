export interface RateLimiterOptions {
  /** 時間窗內最多幾則 */
  max: number
  /** 時間窗長度(毫秒) */
  windowMs: number
  /** 超標後鎖多久(毫秒) */
  lockMs: number
}

export type RateResult = { ok: true } | { ok: false; retryAfterMs: number }

export const DEFAULT_RATE_LIMIT: RateLimiterOptions = {
  max: 5,
  windowMs: 10_000,
  lockMs: 5_000,
}

/** 送出頻率限制:10 秒內最多 5 則,第 6 則會被擋並鎖 5 秒 */
export function createRateLimiter(options: RateLimiterOptions = DEFAULT_RATE_LIMIT) {
  let times: number[] = []
  let lockedUntil = 0

  return {
    tryConsume(now: number = Date.now()): RateResult {
      if (now < lockedUntil) return { ok: false, retryAfterMs: lockedUntil - now }
      times = times.filter((t) => now - t < options.windowMs)
      if (times.length >= options.max) {
        times = []
        lockedUntil = now + options.lockMs
        return { ok: false, retryAfterMs: options.lockMs }
      }
      times.push(now)
      return { ok: true }
    },
    /** 目前鎖到什麼時候(毫秒時間戳),沒鎖就是過去的時間 */
    lockedUntil: () => lockedUntil,
  }
}

export type RateLimiter = ReturnType<typeof createRateLimiter>
