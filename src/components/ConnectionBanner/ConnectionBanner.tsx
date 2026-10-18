import { useEffect, useState } from 'react'
import type { ConnectionStatus } from '../../chat/types'
import { RefreshIcon } from '../icons'

/** 斷線超過這麼久,就從「重新連線中」改成說明該怎麼辦,不要讓使用者一直乾等 */
const LONG_OUTAGE_MS = 30_000

/** 斷線時出現在頂部列下方;連回來後自動消失 */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const [longOutage, setLongOutage] = useState(false)

  useEffect(() => {
    if (status === 'connected') {
      setLongOutage(false)
      return
    }
    const id = setTimeout(() => setLongOutage(true), LONG_OUTAGE_MS)
    return () => clearTimeout(id)
  }, [status])

  if (status === 'connected') return null
  return (
    <div className="banner" role="status">
      <RefreshIcon spin />
      {longOutage ? '還是連不上。請檢查網路;持續失敗的話,重新整理頁面再試一次。' : '連線中斷,重新連線中…'}
    </div>
  )
}
