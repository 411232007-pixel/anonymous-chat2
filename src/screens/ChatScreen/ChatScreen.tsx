import { useEffect, useRef, useState } from 'react'
import type { ChatApi } from '../../hooks/useChat'
import { NARROW_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'
import { ConnectionBanner } from '../../components/ConnectionBanner/ConnectionBanner'
import { MessageInput } from '../../components/MessageInput/MessageInput'
import { MessageList } from '../../components/MessageList/MessageList'
import { OnlineList } from '../../components/OnlineList/OnlineList'
import { ChevronIcon } from '../../components/icons'

export function ChatScreen({ chat }: { chat: ChatApi }) {
  const [draft, setDraft] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const narrow = useMediaQuery(NARROW_QUERY)
  const popover = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  const online = chat.status === 'connected'
  const count = chat.users.length

  // 送出失敗時,把沒送出去的文字放回輸入框,不讓使用者的字消失
  const failedSeq = chat.failed?.seq
  const failedContent = chat.failed?.content
  useEffect(() => {
    if (failedSeq === undefined || failedContent === undefined) return
    setDraft((current) => (current.trim() === '' ? failedContent : `${failedContent}\n${current}`))
  }, [failedSeq, failedContent])

  // 手機的名單面板:按 Esc 或點面板外面就收起
  useEffect(() => {
    if (!listOpen) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') {
          setListOpen(false)
          toggle.current?.focus()
        }
        return
      }
      const target = event.target as Node
      if (!popover.current?.contains(target) && !toggle.current?.contains(target)) setListOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
    }
  }, [listOpen])

  // 切回電腦版面時,收起手機的名單面板
  useEffect(() => {
    if (!narrow) setListOpen(false)
  }, [narrow])

  return (
    <div className="chat">
      <div className="chat__main">
        <header className="topbar">
          <div className="topbar__title">
            <h1>夜間聊天室</h1>
            <span className="topbar__sub">匿名 · 不用登入</span>
          </div>

          {/* 電腦:只顯示人數,名單固定在右側。手機:點開才看到名單 */}
          <div className="online-count online-count--static">
            <span className={online ? 'dot' : 'dot dot--off'} />
            線上 {count} 人
          </div>
          <button
            ref={toggle}
            type="button"
            className="online-count online-count--toggle"
            aria-expanded={listOpen}
            aria-controls="online-popover"
            onClick={() => setListOpen((open) => !open)}
          >
            <span className={online ? 'dot' : 'dot dot--off'} />
            線上 {count} 人
            <ChevronIcon up={listOpen} />
          </button>
        </header>

        <ConnectionBanner status={chat.status} />

        <div className="stage">
          <MessageList items={chat.items} selfId={chat.selfId} loading={!chat.historyLoaded} />

          {narrow && listOpen && (
            <div ref={popover} id="online-popover" className="online-pop">
              <h2 className="online-title">線上 · {count}</h2>
              <OnlineList users={chat.users} selfId={chat.selfId} />
            </div>
          )}
        </div>

        <MessageInput
          draft={draft}
          onDraftChange={(value) => {
            setDraft(value)
            chat.clearFailed()
          }}
          onSend={chat.send}
          offline={!online}
          retrySeconds={chat.retrySeconds}
          sendFailed={chat.failed !== null}
        />
      </div>

      <aside className="online" aria-label="線上名單">
        <h2 className="online-title">線上 · {count}</h2>
        <OnlineList users={chat.users} selfId={chat.selfId} />
      </aside>
    </div>
  )
}
