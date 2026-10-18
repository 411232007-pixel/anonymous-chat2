import { useEffect, useRef, type KeyboardEvent } from 'react'
import { SEARCH_MAX } from '../../logic/search'
import { CloseIcon, SearchIcon } from '../icons'

interface Props {
  query: string
  onChange: (value: string) => void
  onClose: () => void
  /** 符合的訊息數;還沒輸入搜尋字時是 null */
  resultCount: number | null
}

/** 搜尋訊息(只搜尋已載入的訊息,在自己的畫面上篩選) */
export function SearchBar({ query, onChange, onClose, resultCount }: Props) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') onClose()
  }

  let status = '輸入關鍵字,搜尋目前載入的訊息'
  if (resultCount !== null) status = resultCount === 0 ? '沒有符合的訊息' : `找到 ${resultCount} 則訊息`

  return (
    <div className="searchbar" role="search">
      <div className="searchbar__row">
        <span className="searchbar__icon">
          <SearchIcon />
        </span>
        <input
          ref={input}
          className="searchbar__input"
          type="search"
          aria-label="搜尋訊息"
          placeholder="搜尋訊息或代號"
          maxLength={SEARCH_MAX}
          value={query}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="searchbar__close" aria-label="關閉搜尋" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <p className="searchbar__status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
