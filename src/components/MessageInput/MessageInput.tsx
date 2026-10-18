import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useMediaQuery, NARROW_QUERY, TOUCH_QUERY } from '../../hooks/useMediaQuery'
import type { SendResult } from '../../hooks/useChat'
import { remainingChars, validateMessage } from '../../logic/sanitize'
import { AlertIcon, ClockIcon, SendIcon } from '../icons'

/** 剩多少字以內才開始提醒字數 */
const COUNTER_THRESHOLD = 50
const MAX_TEXTAREA_HEIGHT = 168

interface Props {
  draft: string
  onDraftChange: (value: string) => void
  /** 回傳送出的結果;只有 'sent' 時輸入框才會清空 */
  onSend: (draft: string) => SendResult
  offline: boolean
  retrySeconds: number
  sendFailed: boolean
}

export function MessageInput({ draft, onDraftChange, onSend, offline, retrySeconds, sendFailed }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const narrow = useMediaQuery(NARROW_QUERY)
  const touch = useMediaQuery(TOUCH_QUERY)

  // 輸入框隨內容長高,最高到 MAX_TEXTAREA_HEIGHT
  useLayoutEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, MAX_TEXTAREA_HEIGHT)}px`
  }, [draft, narrow])

  const remaining = remainingChars(draft)
  const overLimit = remaining < 0
  const valid = validateMessage(draft).ok
  const limited = retrySeconds > 0
  const canSend = valid && !offline && !limited

  const submit = () => {
    if (!canSend) return
    if (onSend(draft) === 'sent') {
      onDraftChange('')
      textarea.current?.focus()
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // 電腦:Enter 送出、Shift+Enter 換行。手機:Enter 一律換行。
    // 正在用注音/拼音選字時按的 Enter 是「確認選字」,不能當成送出。
    if (event.key !== 'Enter' || event.shiftKey || touch) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    submit()
  }

  // 下方提示列:同一時間只會顯示一種狀態
  let hint: ReactNode = null
  if (offline) {
    hint = <span className="hint">連線恢復後即可繼續發言</span>
  } else if (limited) {
    hint = (
      <span className="hint hint--warn" role="status">
        <ClockIcon />
        送太快了,請稍等一下({retrySeconds} 秒)
      </span>
    )
  } else if (sendFailed) {
    hint = (
      <span className="hint hint--error" role="alert">
        <AlertIcon />
        送出失敗,請再試一次
      </span>
    )
  } else if (!narrow) {
    hint = <span className="hint">Enter 送出 · Shift+Enter 換行</span>
  }

  const showCounter = remaining <= COUNTER_THRESHOLD
  const showMeta = hint !== null || showCounter

  return (
    <div className="composer">
      <div className="composer__inner">
        <div className="composer__row">
          <textarea
            ref={textarea}
            className="composer__input"
            data-invalid={sendFailed || overLimit || undefined}
            aria-label="訊息內容"
            placeholder="輸入訊息…"
            rows={1}
            value={draft}
            disabled={offline}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="btn btn--send" aria-label="送出" disabled={!canSend} onClick={submit}>
            <span className="btn__label">送出</span>
            <SendIcon />
          </button>
        </div>
        {showMeta && (
          <div className="composer__meta">
            <span>{hint}</span>
            {showCounter && (
              <span className={overLimit ? 'counter counter--over' : 'counter'}>
                {overLimit ? `超過 ${-remaining} 字` : `剩 ${remaining} 字`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
