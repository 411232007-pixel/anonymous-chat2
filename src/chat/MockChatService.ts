import type { ChatService, DebugControls } from './ChatService'
import type { ChatEventName, ChatEvents, Message, Unsubscribe, User } from './types'
import { normalizeNickname } from '../logic/nickname'
import { loadJson, removeKey, saveJson } from '../logic/storage'

// 階段一用的假聊天服務。
//  - 聊天室裡有幾個機器人(假使用者),會說話、進進出出,讓畫面看起來是活的。
//  - 同一個瀏覽器開兩個分頁,可以互相聊天(用 BroadcastChannel 互傳)。
//  - 它說的事件名稱、資料格式、順序,和階段二的真服務一致。
// 限制:不同裝置之間不會真的連在一起,要等階段二接上 Supabase。

const CHANNEL_NAME = 'anon-chat:mock-room'
const HISTORY_KEY = 'anon-chat:mock-history'
const HISTORY_LIMIT = 50

interface Bot {
  clientId: string
  nickname: string
  lines: string[]
}

const BOTS: Bot[] = [
  {
    clientId: 'bot:cat',
    nickname: '夜貓',
    lines: [
      '今天雨下得好大,有人也還沒睡嗎?',
      '什麼都可以聊,今天最後一件開心的事就好。',
      '有人推薦深夜可以聽的歌嗎?',
      '剛泡了熱可可,推薦。',
    ],
  },
  {
    clientId: 'bot:lin',
    nickname: '小林',
    lines: ['在趕報告,順便聽雨聲。', '我只看到對面大樓的燈 😅', '+1,我也是這樣。', '咖啡第三杯了。'],
  },
  {
    clientId: 'bot:bo',
    nickname: '阿柏',
    lines: ['哈囉大家。', '第一次來,這裡都聊些什麼?', '剛下班,終於可以坐下來。'],
  },
  {
    clientId: 'bot:ryo',
    nickname: 'Ryo',
    lines: ['看到了,雲剛好散開。', '最近都在聽沒有歌詞的鋼琴曲,很適合寫東西。', 'ok,晚點再回來。'],
  },
  {
    clientId: 'bot:moon',
    nickname: '月光',
    lines: ['那就喝杯熱茶補回來。', '下週有人要去夜市嗎?', '晚安,明天還要早起。'],
  },
  {
    clientId: 'bot:star',
    nickname: '星星',
    lines: ['路過,打個招呼。', '今天的月亮很亮。', '睡不著的人請舉手。'],
  },
]

const INITIALLY_ONLINE = ['bot:cat', 'bot:lin', 'bot:ryo', 'bot:moon']

const REPLIES = [
  '哈哈,同意。',
  '這個我也想過。',
  '真的假的?',
  '有道理。',
  '+1',
  '然後呢?',
  '我也是這樣覺得。',
  '好欸。',
]

const SEED: Array<{ bot: string; minutesAgo: number; text: string }> = [
  { bot: 'bot:cat', minutesAgo: 42, text: '晚安,今天比較晚收工。' },
  { bot: 'bot:lin', minutesAgo: 35, text: '剛吃完泡麵,罪惡感很重。' },
  { bot: 'bot:moon', minutesAgo: 31, text: '那就喝杯熱茶補回來。' },
  { bot: 'bot:cat', minutesAgo: 20, text: '有人看了今天的月亮嗎?很亮。' },
  { bot: 'bot:ryo', minutesAgo: 12, text: '看到了,雲剛好散開。' },
  { bot: 'bot:lin', minutesAgo: 9, text: '我只看到對面大樓的燈 😅' },
  { bot: 'bot:moon', minutesAgo: 5, text: '下週有人要去夜市嗎?' },
  { bot: 'bot:cat', minutesAgo: 3, text: '我可以,看天氣。' },
]

type Wire =
  | { t: 'who' }
  | { t: 'here' | 'hello'; user: User }
  | { t: 'bye'; clientId: string }
  | { t: 'msg'; message: Message }
  | { t: 'typing'; clientId: string; typing: boolean }

export interface MockOptions {
  /** 不放機器人(測試用)。預設放 */
  bots?: boolean
  /** 空聊天室:沒有假的歷史訊息、沒有機器人,並清掉之前存的訊息(看「空狀態」用) */
  empty?: boolean
  /** 所有延遲的倍率。預設 1 */
  latency?: number
}

type Handler = (payload: never) => void

export class MockChatService implements ChatService {
  readonly debug: DebugControls

  private handlers = new Map<ChatEventName, Set<Handler>>()
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private channel: BroadcastChannel | null = null
  private remote = new Map<string, User>()
  private botOnline = new Map<string, User>()
  private queue: Array<() => void> = []
  private me: User | null = null
  private pendingNickname = ''
  private joining = false
  private joined = false
  private offline = false
  private failNext = false
  private lastId = 0
  private lastTypingSentAt = 0
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly botsEnabled: boolean
  private readonly empty: boolean
  private readonly latency: number

  constructor(
    readonly clientId: string,
    options: MockOptions = {},
  ) {
    this.empty = options.empty ?? false
    this.botsEnabled = (options.bots ?? true) && !this.empty
    this.latency = options.latency ?? 1
    this.debug = {
      isOffline: () => this.offline,
      setOffline: (offline) => this.setOffline(offline),
      failNextSend: () => {
        this.failNext = true
      },
      clearStoredMessages: () => removeKey(HISTORY_KEY),
    }
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

  join(nickname: string): void {
    if (this.joined || this.joining) return
    this.joining = true
    this.pendingNickname = nickname
    this.emit('connection:status', 'connecting')
    this.openChannel()
    this.later(() => {
      this.emit('connection:status', 'connected')
      this.post({ t: 'who' })
      // 等一下,讓其他分頁回報「我在線上」,才能檢查代號有沒有重複
      this.later(() => this.finishJoin(), 200)
    }, 450)
  }

  sendMessage(content: string): void {
    if (!this.me) return
    if (this.offline || this.failNext) {
      const reason = this.offline ? 'offline' : 'simulated'
      this.failNext = false
      this.later(() => this.emit('message:failed', { content, reason }), 150)
      return
    }
    const me = this.me
    this.later(() => {
      const message = this.makeMessage(me, content)
      const stored = loadJson<Message[]>(HISTORY_KEY, [])
      saveJson(HISTORY_KEY, [...stored, message].slice(-HISTORY_LIMIT))
      this.post({ t: 'msg', message })
      this.emit('message:new', message)
      this.maybeBotReply()
    }, 120)
  }

  /** 只有同一個瀏覽器的其他分頁看得到(和階段二一樣:節流、對方逾時自動清掉) */
  setTyping(typing: boolean): void {
    if (!this.joined || this.offline) return
    const now = Date.now()
    if (typing) {
      if (now - this.lastTypingSentAt < 2500) return
      this.lastTypingSentAt = now
    } else {
      if (this.lastTypingSentAt === 0) return
      this.lastTypingSentAt = 0
    }
    this.post({ t: 'typing', clientId: this.clientId, typing })
  }

  leave(): void {
    this.resetSession()
  }

  // ---------------------------------------------------------------- 加入

  private finishJoin(): void {
    this.joining = false

    // 機器人也佔用代號,所以要先讓它們「在線上」,才能檢查有沒有重複
    if (this.botsEnabled) {
      const now = Date.now()
      INITIALLY_ONLINE.forEach((id, i) => {
        const bot = BOTS.find((b) => b.clientId === id)
        if (bot) this.botOnline.set(id, { clientId: id, nickname: bot.nickname, joinedAt: now - (i + 1) * 600_000 })
      })
    }

    const wanted = normalizeNickname(this.pendingNickname)
    const taken = this.othersOnline().some((u) => normalizeNickname(u.nickname) === wanted)
    if (taken) {
      this.resetSession()
      this.emit('join:rejected', { reason: 'nickname_taken' })
      return
    }

    if (this.empty) removeKey(HISTORY_KEY)
    this.me = { clientId: this.clientId, nickname: this.pendingNickname, joinedAt: Date.now() }
    this.joined = true
    this.post({ t: 'hello', user: this.me })
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onPageHide)
    if (this.botsEnabled) this.scheduleBot()

    this.emit('join:accepted', { users: [this.me, ...this.othersOnline()] })
    this.later(() => this.emit('history:loaded', this.buildHistory()), 400)
  }

  private othersOnline(): User[] {
    const others = [...this.remote.values()].filter((u) => u.clientId !== this.clientId)
    return [...this.botOnline.values(), ...others]
  }

  private buildHistory(): Message[] {
    const stored = this.empty ? [] : loadJson<Message[]>(HISTORY_KEY, [])
    const now = Date.now()
    const seed: Message[] =
      this.botsEnabled && !this.empty
        ? SEED.map((s, i) => {
            const bot = BOTS.find((b) => b.clientId === s.bot) as Bot
            const at = now - s.minutesAgo * 60_000
            return {
              id: at * 1000 + i,
              clientId: bot.clientId,
              nickname: bot.nickname,
              content: s.text,
              createdAt: new Date(at).toISOString(),
            }
          })
        : []
    const all = [...seed, ...stored].sort((a, b) => a.id - b.id).slice(-HISTORY_LIMIT)
    for (const m of all) this.lastId = Math.max(this.lastId, m.id)
    return all
  }

  // ---------------------------------------------------------------- 機器人

  private scheduleBot(): void {
    this.later(() => {
      this.botTick()
      this.scheduleBot()
    }, 7000 + Math.random() * 11000)
  }

  private botTick(): void {
    const online = BOTS.filter((b) => this.botOnline.has(b.clientId))
    const away = BOTS.filter((b) => !this.botOnline.has(b.clientId))
    const roll = Math.random()
    if (roll < 0.62 && online.length > 0) {
      const bot = online[Math.floor(Math.random() * online.length)]
      this.botSay(bot, bot.lines[Math.floor(Math.random() * bot.lines.length)])
    } else if (roll < 0.81 && online.length > 2) {
      const bot = online[Math.floor(Math.random() * online.length)]
      const user = this.botOnline.get(bot.clientId) as User
      this.botOnline.delete(bot.clientId)
      this.live('presence:left', user)
    } else if (away.length > 0) {
      const bot = away[Math.floor(Math.random() * away.length)]
      const user: User = { clientId: bot.clientId, nickname: bot.nickname, joinedAt: Date.now() }
      this.botOnline.set(bot.clientId, user)
      this.live('presence:joined', user)
    }
  }

  private botSay(bot: Bot, text: string): void {
    const user = this.botOnline.get(bot.clientId)
    if (!user) return
    this.live('message:new', this.makeMessage(user, text))
  }

  private maybeBotReply(): void {
    if (!this.botsEnabled || Math.random() > 0.45) return
    this.later(() => {
      const online = BOTS.filter((b) => this.botOnline.has(b.clientId))
      if (online.length === 0) return
      const bot = online[Math.floor(Math.random() * online.length)]
      this.botSay(bot, REPLIES[Math.floor(Math.random() * REPLIES.length)])
    }, 1500 + Math.random() * 2500)
  }

  // ---------------------------------------------------------------- 斷線測試

  private setOffline(offline: boolean): void {
    if (!this.joined || this.offline === offline) return
    if (offline) {
      this.offline = true
      this.emit('connection:status', 'reconnecting')
      return
    }
    this.later(() => {
      this.offline = false
      const wanted = normalizeNickname(this.me?.nickname ?? '')
      const taken = this.othersOnline().some((u) => normalizeNickname(u.nickname) === wanted)
      if (taken) {
        // 斷線期間代號被別人用了:回到輸入代號畫面
        this.resetSession()
        this.emit('connection:status', 'connected')
        this.emit('join:rejected', { reason: 'nickname_taken' })
        return
      }
      this.emit('connection:status', 'connected')
      const pending = this.queue
      this.queue = []
      pending.forEach((run) => run()) // 補上斷線期間錯過的事件
    }, 700)
  }

  // ---------------------------------------------------------------- 分頁互傳

  private openChannel(): void {
    this.closeChannel()
    if (typeof BroadcastChannel === 'undefined') return
    this.channel = new BroadcastChannel(CHANNEL_NAME)
    this.channel.onmessage = (event: MessageEvent<Wire>) => this.handleWire(event.data)
  }

  private closeChannel(): void {
    this.channel?.close()
    this.channel = null
  }

  private post(wire: Wire): void {
    this.channel?.postMessage(wire)
  }

  private handleWire(wire: Wire): void {
    switch (wire.t) {
      case 'who':
        if (this.me) this.post({ t: 'here', user: this.me })
        break
      case 'here':
        this.remote.set(wire.user.clientId, wire.user)
        break
      case 'hello':
        this.remote.set(wire.user.clientId, wire.user)
        if (this.joined && wire.user.clientId !== this.clientId) this.live('presence:joined', wire.user)
        break
      case 'bye': {
        const user = this.remote.get(wire.clientId)
        if (!user) break
        this.remote.delete(wire.clientId)
        if (this.joined) this.live('presence:left', user)
        break
      }
      case 'typing': {
        if (!this.joined || wire.clientId === this.clientId) break
        const old = this.typingTimers.get(wire.clientId)
        if (old) clearTimeout(old)
        this.typingTimers.delete(wire.clientId)
        this.live('typing:changed', { clientId: wire.clientId, typing: wire.typing })
        if (wire.typing) {
          this.typingTimers.set(
            wire.clientId,
            setTimeout(() => {
              this.typingTimers.delete(wire.clientId)
              this.live('typing:changed', { clientId: wire.clientId, typing: false })
            }, 5000),
          )
        }
        break
      }
      case 'msg':
        if (!this.joined) break
        this.lastId = Math.max(this.lastId, wire.message.id)
        this.live('message:new', wire.message)
        break
    }
  }

  private onPageHide = (): void => {
    this.post({ t: 'bye', clientId: this.clientId })
  }

  // ---------------------------------------------------------------- 小工具

  private resetSession(): void {
    if (this.joined) this.post({ t: 'bye', clientId: this.clientId })
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onPageHide)
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
    this.closeChannel()
    this.remote.clear()
    this.botOnline.clear()
    this.lastTypingSentAt = 0
    for (const id of this.typingTimers.values()) clearTimeout(id)
    this.typingTimers.clear()
    this.queue = []
    this.me = null
    this.joining = false
    this.joined = false
    this.offline = false
  }

  private makeMessage(user: User, content: string): Message {
    const candidate = Date.now() * 1000 + Math.floor(Math.random() * 1000)
    this.lastId = Math.max(candidate, this.lastId + 1)
    return {
      id: this.lastId,
      clientId: user.clientId,
      nickname: user.nickname,
      content,
      createdAt: new Date().toISOString(),
    }
  }

  private later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.timers.delete(id)
      fn()
    }, ms * this.latency)
    this.timers.add(id)
  }

  private emit<E extends ChatEventName>(event: E, payload: ChatEvents[E]): void {
    this.handlers.get(event)?.forEach((handler) => (handler as (p: ChatEvents[E]) => void)(payload))
  }

  /** 斷線期間發生的事先存起來,連回來後再補發 */
  private live<E extends ChatEventName>(event: E, payload: ChatEvents[E]): void {
    if (this.offline) this.queue.push(() => this.emit(event, payload))
    else this.emit(event, payload)
  }
}
