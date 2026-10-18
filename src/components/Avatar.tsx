import { colorIndex } from '../logic/color'

/** 圓形頭像:顯示代號的第一個字,顏色由代號決定(同一個代號永遠同一色) */
export function Avatar({ nickname, size }: { nickname: string; size: 'md' | 'sm' }) {
  const initial = Array.from(nickname)[0] ?? '?'
  return (
    <span className="avatar" data-size={size} data-c={colorIndex(nickname)} aria-hidden="true">
      {initial.toUpperCase()}
    </span>
  )
}
