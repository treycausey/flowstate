"use client"

type Props = {
  size?: number
  stroke?: number
  progress: number // 0..1
  color?: string
  trackColor?: string
  testId?: string
}

export default function ProgressRing({
  size = 28,
  stroke = 3,
  progress,
  color = 'var(--accent)',
  trackColor = 'var(--border)',
  testId,
}: Props) {
  const p = Math.max(0, Math.min(1, progress))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c
  const offset = c * (1 - p)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      data-testid={testId}
      style={{ display: 'block' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={trackColor}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

