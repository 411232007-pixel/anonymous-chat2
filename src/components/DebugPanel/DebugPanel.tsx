import { useState } from 'react'
import type { DebugControls } from '../../chat/ChatService'

/**
 * 測試用的小面板,只有網址帶 ?debug 時才會出現。
 * 用來手動製造斷線、送出失敗,方便檢查畫面。階段二接上真服務後就不會出現。
 */
export function DebugPanel({ controls }: { controls: DebugControls }) {
  const [offline, setOffline] = useState(controls.isOffline())

  return (
    <aside className="debug" aria-label="測試面板">
      <strong>測試面板</strong>
      <button
        type="button"
        onClick={() => {
          controls.setOffline(!offline)
          setOffline(!offline)
        }}
      >
        {offline ? '恢復連線' : '模擬斷線'}
      </button>
      <button type="button" onClick={() => controls.failNextSend()}>
        下一則送出失敗
      </button>
      <button type="button" onClick={() => controls.clearStoredMessages()}>
        清掉我送過的訊息
      </button>
    </aside>
  )
}
