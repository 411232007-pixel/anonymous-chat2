import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatApi, JoinError } from '../../hooks/useChat'
import { NICKNAME_MAX, countChars, validateNickname } from '../../logic/nickname'
import { loadNickname } from '../../logic/storage'
import { AlertIcon, RefreshIcon } from '../../components/icons'

const ERROR_TEXT: Record<JoinError, string> = {
  empty: '請輸入代號。',
  too_long: `代號最多 ${NICKNAME_MAX} 個字。`,
  invalid_chars: '代號含有不能使用的字元,請換一個。',
  nickname_taken: '這個代號有人在用了,請換一個。',
  connection_lost: '連線中斷太久,代號已被使用,請重新選擇。',
  unavailable: '連不上聊天室,請檢查網路後再試一次。',
}

export function JoinScreen({ chat }: { chat: ChatApi }) {
  const saved = useRef(loadNickname())
  const [value, setValue] = useState(saved.current)
  const [touched, setTouched] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const joining = chat.phase === 'joining'

  // 進來時直接選取預先填入的代號,想改的人一打字就會取代;被退回來時也一樣
  useEffect(() => {
    if (!joining) input.current?.select()
  }, [joining, chat.joinError])

  const check = validateNickname(value)
  // 即時顯示的錯誤:字太長、有不能用的字元;「空白」只在使用者清空之後才提醒
  const liveError: JoinError | null = check.ok
    ? null
    : check.error === 'empty' && !touched
      ? null
      : check.error
  const error = liveError ?? chat.joinError

  const length = countChars(value)
  const prefilled = !touched && saved.current !== '' && value === saved.current
  const canSubmit = check.ok && !joining

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (canSubmit) chat.join(value)
  }

  return (
    <main className="join">
      <div className="join__card">
        <header className="join__intro">
          <h1 className="join__title">夜間聊天室</h1>
          <p className="join__lead">
            不用註冊,取個代號就能進來。
            <br />
            這裡是匿名的,關掉分頁就算離開。
          </p>
        </header>

        <form className="join__form" onSubmit={submit} noValidate>
          <div className="field">
            <div className="field__head">
              <label htmlFor="nickname" className="field__label">
                你的代號
              </label>
              <span className={length > NICKNAME_MAX ? 'field__count field__count--over' : 'field__count'}>
                {length} / {NICKNAME_MAX}
              </span>
            </div>
            <input
              ref={input}
              id="nickname"
              className="field__input"
              type="text"
              value={value}
              disabled={joining}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={error ? true : undefined}
              aria-describedby="nickname-note"
              onChange={(event) => {
                setValue(event.target.value)
                setTouched(true)
              }}
            />
            <p
              id="nickname-note"
              className={error ? 'field__note field__note--error' : 'field__note'}
              role={error ? 'alert' : undefined}
            >
              {error ? (
                <>
                  <AlertIcon size={14} />
                  {ERROR_TEXT[error]}
                </>
              ) : prefilled ? (
                '這是你上次用的代號,可以直接進入,也可以修改。'
              ) : (
                `1~${NICKNAME_MAX} 個字,中文、英文、emoji 都可以。`
              )}
            </p>
          </div>

          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            {joining ? (
              <>
                <RefreshIcon spin />
                連線中…
              </>
            ) : (
              '進入聊天室'
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
