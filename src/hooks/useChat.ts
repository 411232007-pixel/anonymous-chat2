import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { ChatService } from '../chat/ChatService'
import type { ConnectionStatus, Message, User } from '../chat/types'
import { validateNickname, type NicknameError } from '../logic/nickname'
import { validateMessage } from '../logic/sanitize'
import { createRateLimiter } from '../logic/rateLimit'
import { saveNickname } from '../logic/storage'

export type Phase = 'join' | 'joining' | 'chat'

/** 輸入代號畫面要顯示的錯誤(由畫面轉成文字) */
export type JoinError = NicknameError | 'nickname_taken' | 'connection_lost'

/** 對話裡的一項:一則訊息,或一行系統提示(進來/離開) */
export type TimelineItem =
  | { key: string; kind: 'message'; message: Message }
  | { key: string; kind: 'system'; text: string }

export type SendResult = 'sent' | 'empty' | 'too_long' | 'limited'

interface State {
  phase: Phase
  joinError: JoinError | null
  status: ConnectionStatus
  nickname: string
  users: User[]
  items: TimelineItem[]
  historyLoaded: boolean
  failed: { content: string; seq: number } | null
  seq: number
}

type Action =
  | { type: 'join_requested'; nickname: string }
  | { type: 'join_invalid'; error: NicknameError }
  | { type: 'join_accepted'; users: User[] }
  | { type: 'join_rejected' }
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'history'; messages: Message[] }
  | { type: 'message'; message: Message }
  | { type: 'failed'; content: string }
  | { type: 'clear_failed' }
  | { type: 'sync'; users: User[] }
  | { type: 'joined'; user: User }
  | { type: 'left'; user: User }

const initialState: State = {
  phase: 'join',
  joinError: null,
  status: 'connecting',
  nickname: '',
  users: [],
  items: [],
  historyLoaded: false,
  failed: null,
  seq: 0,
}

function messageItem(message: Message): TimelineItem {
  return { key: `m-${message.id}`, kind: 'message', message }
}

/** 自己排第一,其他人依加入時間排 */
function sortUsers(users: User[], selfId: string): User[] {
  return [...users].sort((a, b) => {
    if (a.clientId === selfId) return -1
    if (b.clientId === selfId) return 1
    return a.joinedAt - b.joinedAt
  })
}

function makeReducer(selfId: string) {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case 'join_requested':
        return { ...initialState, phase: 'joining', nickname: action.nickname }
      case 'join_invalid':
        return { ...state, phase: 'join', joinError: action.error }
      case 'join_accepted':
        return {
          ...state,
          phase: 'chat',
          joinError: null,
          users: sortUsers(action.users, selfId),
          items: [],
          historyLoaded: false,
        }
      case 'join_rejected':
        // 在聊天室裡被拒絕 = 斷線太久,代號被別人佔走了
        return {
          ...initialState,
          nickname: state.nickname,
          joinError: state.phase === 'chat' ? 'connection_lost' : 'nickname_taken',
        }
      case 'status':
        return { ...state, status: action.status }
      case 'history':
        return { ...state, items: action.messages.map(messageItem), historyLoaded: true }
      case 'message': {
        const exists = state.items.some((i) => i.kind === 'message' && i.message.id === action.message.id)
        if (exists) return state
        return { ...state, items: [...state.items, messageItem(action.message)] }
      }
      case 'failed':
        return { ...state, failed: { content: action.content, seq: state.seq + 1 }, seq: state.seq + 1 }
      case 'clear_failed':
        return state.failed ? { ...state, failed: null } : state
      case 'sync':
        return { ...state, users: sortUsers(action.users, selfId) }
      case 'joined': {
        if (state.phase !== 'chat' || state.users.some((u) => u.clientId === action.user.clientId)) return state
        const seq = state.seq + 1
        return {
          ...state,
          seq,
          users: sortUsers([...state.users, action.user], selfId),
          items: [...state.items, { key: `s-${seq}`, kind: 'system', text: `${action.user.nickname} 進來了` }],
        }
      }
      case 'left': {
        if (state.phase !== 'chat' || !state.users.some((u) => u.clientId === action.user.clientId)) return state
        const seq = state.seq + 1
        return {
          ...state,
          seq,
          users: state.users.filter((u) => u.clientId !== action.user.clientId),
          items: [...state.items, { key: `s-${seq}`, kind: 'system', text: `${action.user.nickname} 離開了` }],
        }
      }
    }
  }
}

export interface ChatApi {
  service: ChatService
  selfId: string
  phase: Phase
  joinError: JoinError | null
  status: ConnectionStatus
  nickname: string
  users: User[]
  items: TimelineItem[]
  historyLoaded: boolean
  failed: { content: string; seq: number } | null
  /** 還要等幾秒才能再送(0 = 沒被限速) */
  retrySeconds: number
  join: (rawNickname: string) => void
  send: (rawDraft: string) => SendResult
  clearFailed: () => void
}

export function useChat(service: ChatService): ChatApi {
  const selfId = service.clientId
  const [state, dispatch] = useReducer(makeReducer(selfId), initialState)
  const limiter = useRef(createRateLimiter())
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const pendingNickname = useRef('')

  useEffect(() => {
    const offs = [
      service.on('connection:status', (status) => dispatch({ type: 'status', status })),
      service.on('join:accepted', ({ users }) => {
        saveNickname(pendingNickname.current)
        dispatch({ type: 'join_accepted', users })
      }),
      service.on('join:rejected', () => dispatch({ type: 'join_rejected' })),
      service.on('history:loaded', (messages) => dispatch({ type: 'history', messages })),
      service.on('message:new', (message) => dispatch({ type: 'message', message })),
      service.on('message:failed', ({ content }) => dispatch({ type: 'failed', content })),
      service.on('presence:sync', (users) => dispatch({ type: 'sync', users })),
      service.on('presence:joined', (user) => dispatch({ type: 'joined', user })),
      service.on('presence:left', (user) => dispatch({ type: 'left', user })),
    ]
    return () => offs.forEach((off) => off())
  }, [service])

  // 被限速時,每 250ms 更新一次倒數
  useEffect(() => {
    if (lockedUntil <= Date.now()) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [lockedUntil])

  const join = useCallback(
    (raw: string) => {
      const result = validateNickname(raw)
      if (!result.ok) {
        dispatch({ type: 'join_invalid', error: result.error })
        return
      }
      pendingNickname.current = result.nickname
      dispatch({ type: 'join_requested', nickname: result.nickname })
      service.join(result.nickname)
    },
    [service],
  )

  const send = useCallback(
    (raw: string): SendResult => {
      const result = validateMessage(raw)
      if (!result.ok) return result.error
      const rate = limiter.current.tryConsume()
      if (!rate.ok) {
        const until = Date.now() + rate.retryAfterMs
        setLockedUntil(until)
        setNow(Date.now())
        return 'limited'
      }
      dispatch({ type: 'clear_failed' })
      service.sendMessage(result.content)
      return 'sent'
    },
    [service],
  )

  const clearFailed = useCallback(() => dispatch({ type: 'clear_failed' }), [])

  const retrySeconds = lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0

  return {
    service,
    selfId,
    phase: state.phase,
    joinError: state.joinError,
    status: state.status,
    nickname: state.nickname,
    users: state.users,
    items: state.items,
    historyLoaded: state.historyLoaded,
    failed: state.failed,
    retrySeconds,
    join,
    send,
    clearFailed,
  }
}
