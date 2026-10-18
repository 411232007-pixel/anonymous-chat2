import type { User } from '../../chat/types'
import { typingLabel } from '../../logic/typing'

/** 輸入框上方的「○○ 正在輸入…」。固定保留一行高度,出現和消失時畫面不會跳動 */
export function TypingIndicator({ users }: { users: User[] }) {
  const label = typingLabel(users.map((u) => u.nickname))
  return (
    <div className="typing" role="status" aria-live="polite">
      {label && (
        <>
          <span className="typing__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="typing__text">{label}</span>
        </>
      )}
    </div>
  )
}
