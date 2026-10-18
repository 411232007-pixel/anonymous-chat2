import { useSyncExternalStore } from 'react'

/** 追蹤 CSS 媒體查詢的結果(例如螢幕寬度、是不是觸控裝置) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** 手機版面的斷點,要和 styles/chat.css 裡的 @media 一致 */
export const NARROW_QUERY = '(max-width: 760px)'
/** 以手指為主的裝置:Enter 是換行,不是送出 */
export const TOUCH_QUERY = '(pointer: coarse)'
