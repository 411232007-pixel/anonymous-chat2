import { useEffect } from 'react'

/**
 * 手機的虛擬鍵盤跳出來時,可視範圍會變小。
 * 把「目前看得到的高度」存成 CSS 變數 --app-h,讓輸入框不會被鍵盤蓋住。
 */
export function useAppHeight(): void {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      document.documentElement.style.setProperty('--app-h', `${viewport.height}px`)
      // iOS 會把整頁往上推,推回原位
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      document.documentElement.style.removeProperty('--app-h')
    }
  }, [])
}
