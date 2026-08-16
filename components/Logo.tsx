'use client'

type Props = { size?: number; color?: string; title?: string }

export default function Logo({ size = 24, color = 'var(--accent)', title = 'Flowstate' }: Props) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" role="img" aria-label={title}>
      <defs>
        <linearGradient id="fs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6" ry="6" fill="none" stroke="var(--border)" />
      <path
        d="M3 10c2 0 3-3 6-3s4 3 7 3 4-3 5-3"
        fill="none"
        stroke="url(#fs-g)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3 14c2 0 3-3 6-3s4 3 7 3 4-3 5-3"
        fill="none"
        stroke="url(#fs-g)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
