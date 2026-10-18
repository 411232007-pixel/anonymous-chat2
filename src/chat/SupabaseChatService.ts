import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ChatService } from './ChatService'
import type { ChatEventName, ChatEvents, JoinRejectReason, Message, Unsubscribe, User } from './types'
import { normalizeNickname } from '../logic/nickname'

// 階段二用的真聊天服務,對應 docs/architecture.md 第 5.4 節:
//  - 訊息存在 messages 資料表,新訊息靠 Realtime 的 Postgres Changes 推給大家。
//  - 線上名單靠 Presence(每個分頁登記 { clientId, nickname, joinedAt })。
// 它發出的事件和 MockChatService 一致,畫面不需要知道背後是哪一個。

const CHANNEL_NAME = 'anon-chat:room'
const HISTORY_LIMIT = 50
const CATCH_UP_LIMIT = 500
const SYNC_WAIT_MS = 1500
const CONNECT_TIMEOUT_MS = 12_000
const SEND_TIMEOUT_MS = 10_000
const RETRY_MS = 3000
const SEEN_LIMIT = 1000
/** 「正在輸入」:自己最多每 2.5 秒發一次;別人超過 5 秒沒更新就當作停止 */
const TYPING_SEND_INTERVAL_MS = 2500
const TYPING_EXPIRE_MS = 5000

interface MessageRow {
  id: number
  client_id: string
  nickname: string
  content: string
  created_at: string
}

function parseRow(raw: unknown): MessageRow | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.id !== 'number' ||
    typeof r.client_id !== 'string' ||
    typeof r.nickname !== 'string' ||
    typeof r.content !== 'string' ||
    typeof r.created_at !== 'string'
  ) {
    return null
  }
  return { id: r.id, client_id: r.client_id, nickname: r.nickname, content: r.content, created_at: r.created_at }
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    clientId: row.client_id,
    nickname: row.nickname,
    content: row.content,
    createdAt: row.created_at,
  }
}

function parseUser(raw: unknown): User | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.clientId !== 'string' || typeof r.nickname !== 'string' || typeof r.joinedAt !== 'number') return null
  return { clientId: r.clientId, nickname: r.nickname, joinedAt: r.joinedAt }
}

type Handler = (payload: never) => void

export class SupabaseChatService implements ChatService {
  private client: SupabaseClient
  private handlers = new Map<ChatEventName, Set<Handler>>()
  private channel: RealtimeChannel | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private syncWaiters: Array<() => void> = []
  private me: User | null = null
  private pendingNickname = ''
  private joining = false
  private joined = false
  private online = false
  private synced = false
  private historyReady = false
  private buffer: Message[] = []
  private seen = new Set<number>()
  private lastId = 0
  private lastTypingSentAt = 0
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** 每次加入/離開都加一;過期的非同步回呼靠它辨認並丟掉 */
  private session = 0

  constructor(
    readonly clientId: string,
    url: string,
    publishableKey: string,
  ) {
    // 沒有登入功能,所以不需要(也不要)保存登入狀態
    this.client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }

  on<E extends ChatEventName>(event: E, handler: (payload: ChatEvents[E]) => void): Unsubscribe {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as Handler)
    return () => {
      set.delete(handler as Handler)
    }
  }

  // ---------------------------------------------------------------- 加入

  join(nickname: string): void {
    if (this.joined || this.joining) return
    this.joining = true
    this.pendingNickname = nickname
    const session = ++this.session
    this.emit('connection:status', 'connecting')

    const channel = this.client.channel(CHANNEL_NAME, {
      config: { presence: { key: this.clientId }, broadcast: { self: false } },
    })
    this.channel = channel
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => this.onTyping(session, payload))
      .on('presence', { event: 'sync' }, () => this.onSync(session))
      .on('presence', { event: 'join' }, ({ newPresences }) => this.onPresence(session, 'presence:joined', newPresences))
      .on('presence', { event: 'leave' }, ({ leftPresences }) => this.onPresence(session, 'presence:left', leftPresences))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
        this.onInsert(session, payload.new),
      )
      .subscribe((status) => this.onStatus(session, status))

    // 一直連不上(網路不通、專案被暫停、達到連線上限)要明確告訴使用者,不要一直轉圈
    this.later(() => {
      if (session === this.session && this.joining && !this.online) this.failJoin('unavailable')
    }, CONNECT_TIMEOUT_MS)
  }

  sendMessage(content: string): void {
    const me = this.me
    if (!me) return
    if (!this.online) {
      this.fail(content, 'offline')
      return
    }
    // 不先在畫面上假裝送出:等資料庫的新增事件回來才顯示,所有人看到的順序才一致
    void (async () => {
      try {
        const { error } = await this.client
          .from('messages')
          .insert({ client_id: me.clientId, nickname: me.nickname, content })
          .abortSignal(AbortSignal.timeout(SEND_TIMEOUT_MS))
        if (error) this.fail(content, error.message)
      } catch (error) {
        this.fail(content, error instanceof Error ? error.message : 'unknown')
      }
    })()
  }

  setTyping(typing: boolean): void {
    if (!this.joined || !this.online || !this.channel) return
    const now = Date.now()
    if (typing) {
      if (now - this.lastTypingSentAt < TYPING_SEND_INTERVAL_MS) return // 節流:不要每個按鍵都送
      this.lastTypingSentAt = now
    } else {
      if (this.lastTypingSentAt === 0) return // 本來就沒在輸入,不用通知
      this.lastTypingSentAt = 0
    }
    // 「正在輸入」只是提示,送不出去也沒關係,所以不處理失敗
    void this.channel
      .send({ type: 'broadcast', event: 'typing', payload: { clientId: this.clientId, typing } })
      .catch(() => undefined)
  }

  leave(): void {
    this.teardown()
  }

  /** 收到別人的「正在輸入」。內容來自網路,先檢查格式再使用 */
  private onTyping(session: number, raw: unknown): void {
    if (session !== this.session || !this.joined) return
    if (typeof raw !== 'object' || raw === null) return
    const r = raw as Record<string, unknown>
    if (typeof r.clientId !== 'string' || typeof r.typing !== 'boolean') return
    if (r.clientId === this.clientId || r.clientId.length > 64) return
    const clientId = r.clientId

    const old = this.typingTimers.get(clientId)
    if (old) clearTimeout(old)
    if (!r.typing) {
      this.typingTimers.delete(clientId)
      this.emit('typing:changed', { clientId, typing: false })
      return
    }
    this.emit('typing:changed', { clientId, typing: true })
    // 對方關掉分頁、斷線時不會再通知「停止」,所以一段時間沒更新就自己清掉
    this.typingTimers.set(
      clientId,
      setTimeout(() => {
        this.typingTimers.delete(clientId)
        this.emit('typing:changed', { clientId, typing: false })
      }, TYPING_EXPIRE_MS),
    )
  }

  // ---------------------------------------------------------------- 連線狀態

  private onStatus(session: number, status: string): void {
    if (session !== this.session) return
    if (status === 'SUBSCRIBED') {
      this.online = true
      void this.onSubscribed(session)
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      // supabase-js 會自己重試;這裡只負責讓畫面顯示「重新連線中」
      this.online = false
      this.synced = false
      if (this.joined) this.emit('connection:status', 'reconnecting')
    }
  }

  private async onSubscribed(session: number): Promise<void> {
    if (this.joined) {
      await this.waitForSync()
      if (session === this.session) await this.resume(session)
      return
    }
    this.emit('connection:status', 'connected')
    await this.waitForSync() // 等 Presence 把目前線上名單送來,才能檢查代號有沒有重複
    if (session === this.session && this.joining) await this.acceptOrReject(session)
  }

  private async acceptOrReject(session: number): Promise<void> {
    const wanted = normalizeNickname(this.pendingNickname)
    if (this.othersPresent().some((u) => normalizeNickname(u.nickname) === wanted)) {
      this.failJoin('nickname_taken')
      return
    }

    const me: User = { clientId: this.clientId, nickname: this.pendingNickname, joinedAt: Date.now() }
    this.me = me
    this.synced = false
    if (!(await this.track(me)) || session !== this.session) {
      if (session === this.session) this.failJoin('unavailable')
      return
    }

    // 兩個人同時搶同一個代號:登記後再看一次,joinedAt 較早的留下,較晚的被通知
    await this.waitForSync()
    if (session !== this.session) return
    const rival = this.othersPresent().find(
      (u) =>
        normalizeNickname(u.nickname) === wanted &&
        (u.joinedAt < me.joinedAt || (u.joinedAt === me.joinedAt && u.clientId < me.clientId)),
    )
    if (rival) {
      this.failJoin('nickname_taken')
      return
    }

    this.joined = true
    this.joining = false
    this.clearTimers()
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onPageHide)
    this.emit('join:accepted', { users: [me, ...this.othersPresent()] })
    void this.loadHistory(session, 1)
  }

  /** 斷線後重新連上:重新登記上線、補上錯過的訊息 */
  private async resume(session: number): Promise<void> {
    const me = this.me
    if (!me) return
    const wanted = normalizeNickname(me.nickname)
    if (this.othersPresent().some((u) => normalizeNickname(u.nickname) === wanted)) {
      // 斷線期間代號被別人用了:回到輸入代號畫面
      this.teardown()
      this.emit('connection:status', 'connected')
      this.emit('join:rejected', { reason: 'nickname_taken' })
      return
    }
    if (!(await this.track(me)) || session !== this.session) {
      if (session === this.session) this.later(() => void this.resume(session), RETRY_MS)
      return
    }
    this.emit('connection:status', 'connected')
    void this.catchUp(session)
  }

  // ---------------------------------------------------------------- 訊息

  private onInsert(session: number, raw: unknown): void {
    if (session !== this.session || !this.joined) return
    const row = parseRow(raw)
    if (!row) return
    const message = toMessage(row)
    if (this.historyReady) this.deliver(message)
    else this.buffer.push(message) // 歷史訊息還在載入,先暫存,載完再補
  }

  /** 送出新訊息事件;同一個編號只送一次 */
  private deliver(message: Message): void {
    if (this.seen.has(message.id)) return
    this.remember(message)
    this.emit('message:new', message)
  }

  private remember(message: Message): void {
    this.seen.add(message.id)
    this.lastId = Math.max(this.lastId, message.id)
    if (this.seen.size > SEEN_LIMIT) {
      const oldest = this.seen.values().next().value
      if (oldest !== undefined) this.seen.delete(oldest)
    }
  }

  private async loadHistory(session: number, attempt: number): Promise<void> {
    const { data, error } = await this.client
      .from('messages')
      .select('id, client_id, nickname, content, created_at')
      .order('id', { ascending: false })
      .limit(HISTORY_LIMIT)
    if (session !== this.session) return

    if (error) {
      if (attempt < 3) {
        this.later(() => void this.loadHistory(session, attempt + 1), RETRY_MS)
        return
      }
      this.finishHistory([]) // 讀不到就先當作空的,不要讓畫面一直顯示載入中
      return
    }
    const messages = (data ?? [])
      .map(parseRow)
      .filter((row): row is MessageRow => row !== null)
      .map(toMessage)
      .reverse() // 查詢是新到舊,畫面要舊到新
    this.finishHistory(messages)
  }

  private finishHistory(messages: Message[]): void {
    for (const message of messages) this.remember(message)
    this.emit('history:loaded', messages)
    this.historyReady = true
    const pending = this.buffer
    this.buffer = []
    pending.forEach((message) => this.deliver(message))
  }

  private async catchUp(session: number): Promise<void> {
    const { data, error } = await this.client
      .from('messages')
      .select('id, client_id, nickname, content, created_at')
      .gt('id', this.lastId)
      .order('id', { ascending: true })
      .limit(CATCH_UP_LIMIT)
    if (session !== this.session) return
    if (error) {
      this.later(() => void this.catchUp(session), RETRY_MS)
      return
    }
    for (const row of data ?? []) {
      const parsed = parseRow(row)
      if (parsed) this.deliver(toMessage(parsed))
    }
  }

  private fail(content: string, reason: string): void {
    // 稍後再發出,避免在呼叫 sendMessage 的同一刻就觸發畫面更新
    queueMicrotask(() => this.emit('message:failed', { content, reason }))
  }

  // ---------------------------------------------------------------- 線上名單

  private onSync(session: number): void {
    if (session !== this.session) return
    this.synced = true
    const waiters = this.syncWaiters
    this.syncWaiters = []
    waiters.forEach((resolve) => resolve())
    if (this.joined && this.me) this.emit('presence:sync', [this.me, ...this.othersPresent()])
  }

  private onPresence(session: number, event: 'presence:joined' | 'presence:left', metas: unknown[]): void {
    if (session !== this.session || !this.joined) return
    for (const meta of metas) {
      const user = parseUser(meta)
      if (user && user.clientId !== this.clientId) this.emit(event, user)
    }
  }

  /** 目前線上、不是我自己的人 */
  private othersPresent(): User[] {
    if (!this.channel) return []
    const users: User[] = []
    for (const [key, metas] of Object.entries(this.channel.presenceState())) {
      if (key === this.clientId) continue
      const user = parseUser(metas[metas.length - 1])
      if (user && user.clientId !== this.clientId) users.push(user)
    }
    return users
  }

  private async track(me: User): Promise<boolean> {
    if (!this.channel) return false
    try {
      return (await this.channel.track({ ...me })) === 'ok'
    } catch {
      return false
    }
  }

  /** 等 Presence 同步;最多等一下,不要卡住 */
  private waitForSync(): Promise<void> {
    if (this.synced) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(done, SYNC_WAIT_MS)
      this.syncWaiters.push(done)
    })
  }

  // ---------------------------------------------------------------- 小工具

  private failJoin(reason: JoinRejectReason): void {
    this.teardown()
    this.emit('join:rejected', { reason })
  }

  private onPageHide = (): void => {
    // 關掉分頁時主動說「我離開了」,別人不用等到連線逾時才看到
    void this.channel?.untrack()
  }

  private teardown(): void {
    const channel = this.channel
    this.session++
    this.clearTimers()
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onPageHide)
    const waiters = this.syncWaiters
    this.syncWaiters = []
    waiters.forEach((resolve) => resolve())
    this.channel = null
    this.me = null
    this.joining = false
    this.joined = false
    this.online = false
    this.synced = false
    this.historyReady = false
    this.buffer = []
    this.seen.clear()
    this.lastId = 0
    this.lastTypingSentAt = 0
    for (const id of this.typingTimers.values()) clearTimeout(id)
    this.typingTimers.clear()
    if (channel) {
      void channel
        .untrack()
        .catch(() => undefined)
        .then(() => this.client.removeChannel(channel))
    }
  }

  private later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.timers.delete(id)
      fn()
    }, ms)
    this.timers.add(id)
  }

  private clearTimers(): void {
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
  }

  private emit<E extends ChatEventName>(event: E, payload: ChatEvents[E]): void {
    this.handlers.get(event)?.forEach((handler) => (handler as (p: ChatEvents[E]) => void)(payload))
  }
}
