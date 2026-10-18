import type { ReactNode } from 'react'

// 同一套線條圖示(描邊 2px、圓角線端)。只用來裝飾,所以預設隱藏給讀屏軟體。

function Icon({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

type P = { size?: number }

export const SendIcon = ({ size }: P) => (
  <Icon size={size}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </Icon>
)

export const ArrowDownIcon = ({ size }: P) => (
  <Icon size={size}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)

export const ChevronIcon = ({ size, up = false }: P & { up?: boolean }) => (
  <Icon size={size}>
    <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
  </Icon>
)

export const RefreshIcon = ({ size, spin = false }: P & { spin?: boolean }) => (
  <span className={spin ? 'icon-spin' : undefined} style={{ display: 'inline-flex' }}>
    <Icon size={size}>
      <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
    </Icon>
  </span>
)

export const ClockIcon = ({ size }: P) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)

export const AlertIcon = ({ size }: P) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Icon>
)

export const ChatIcon = ({ size }: P) => (
  <Icon size={size}>
    <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
  </Icon>
)

export const SearchIcon = ({ size }: P) => (
  <Icon size={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
)

export const CloseIcon = ({ size }: P) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
