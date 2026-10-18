import { useLayoutEffect, useRef, useState } from 'react'
import type { Message } from '../../chat/types'
import type { TimelineItem } from '../../hooks/useChat'
import { Avatar } from '../Avatar'
import { ArrowDownIcon, ChatIcon } from '../icons'

const BOTTOM_THRESHOLD = 48

const timeFormat = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : timeFormat.format(date)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface Props {
  items: TimelineItem[]
  selfId: string
  /** 最近的訊息還在載入 */
  loading: boolean
}

export function MessageList({ items, selfId, loading }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const previousCount = useRef(0)
  const [hasUnseen, setHasUnseen] = useState(false)

  // 有新項目時決定要不要捲到最底:
  //  - 第一次載入、或是自己送的訊息 → 一定捲到最底
  //  - 使用者停在最底 → 跟著捲
  //  - 使用者正在往上看舊訊息 → 不打斷他,改顯示「有新訊息 ↓」
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const added = items.slice(previousCount.current)
    const isFirstLoad = previousCount.current === 0
    previousCount.current = items.length
    if (added.length === 0) return

    const sentByMe = added.some((i) => i.kind === 'message' && i.message.clientId === selfId)
    if (isFirstLoad || sentByMe || atBottom.current) {
      el.scrollTop = el.scrollHeight
      atBottom.current = true
      setHasUnseen(false)
    } else if (added.some((i) => i.kind === 'message')) {
      setHasUnseen(true)
    }
  }, [items, selfId])

  const handleScroll = () => {
    const el = scroller.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    if (atBottom.current) setHasUnseen(false)
  }

  const jumpToLatest = () => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    setHasUnseen(false)
  }

  return (
    <div className="stage__messages">
      <div
        ref={scroller}
        className="list"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="聊天訊息"
        aria-busy={loading}
        tabIndex={0}
      >
        <div className="list__inner">
          {loading ? (
            <Skeleton />
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            items.map((item) =>
              item.kind === 'system' ? (
                <div key={item.key} className="system-line">
                  {item.text}
                </div>
              ) : (
                <MessageRow key={item.key} message={item.message} mine={item.message.clientId === selfId} />
              ),
            )
          )}
        </div>
      </div>

      {hasUnseen && (
        <button type="button" className="new-messages" onClick={jumpToLatest}>
          有新訊息
          <ArrowDownIcon />
        </button>
      )}
    </div>
  )
}

function MessageRow({ message, mine }: { message: Message; mine: boolean }) {
  const time = formatTime(message.createdAt)
  if (mine) {
    return (
      <div className="msg msg--mine">
        <span className="msg__time">{time}</span>
        <div className="bubble bubble--mine">{message.content}</div>
      </div>
    )
  }
  return (
    <div className="msg">
      <Avatar nickname={message.nickname} size="md" />
      <div className="msg__body">
        <div className="msg__meta">
          <span className="msg__name">{message.nickname}</span>
          <span className="msg__time">{time}</span>
        </div>
        <div className="bubble">{message.content}</div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="skeleton__row">
        <span className="skeleton__avatar" />
        <div className="skeleton__col">
          <span className="skeleton__name" style={{ width: 60 }} />
          <span className="skeleton__bubble" style={{ width: '80%' }} />
        </div>
      </div>
      <div className="skeleton__row skeleton__row--mine">
        <span className="skeleton__bubble" style={{ width: '55%' }} />
      </div>
      <div className="skeleton__row">
        <span className="skeleton__avatar" />
        <div className="skeleton__col">
          <span className="skeleton__name" style={{ width: 48 }} />
          <span className="skeleton__bubble" style={{ width: '65%' }} />
        </div>
      </div>
      <p className="skeleton__text">正在載入最近的訊息…</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty">
      <ChatIcon size={28} />
      <p className="empty__title">還沒有人說話</p>
      <p className="empty__text">你來說第一句吧。</p>
    </div>
  )
}
