import type { ConnectionStatus } from '../../chat/types'
import { RefreshIcon } from '../icons'

/** 斷線時出現在頂部列下方;連回來後自動消失 */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') return null
  return (
    <div className="banner" role="status">
      <RefreshIcon spin />
      連線中斷,重新連線中…
    </div>
  )
}
