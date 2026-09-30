'use client'

import type { MouseEvent, ReactNode } from 'react'

/** Toggle button used for every choice in the plants screens. Real button, `aria-pressed`. */
export function ToggleChip({
  pressed,
  onClick,
  children,
  className = '',
  disabled,
  ...rest
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
  'aria-describedby'?: string
}) {
  return (
    <button
      type="button"
      className={`choice-chip ${className}`.trim()}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A link that navigates in-app on a plain click and stays a real link for everything else. */
export function RouteLink({
  href,
  onNavigate,
  children,
  className,
  'aria-label': ariaLabel,
  'aria-current': ariaCurrent,
}: {
  href: string
  onNavigate: () => void
  children: ReactNode
  className?: string
  'aria-label'?: string
  'aria-current'?: 'page'
}) {
  return (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.defaultPrevented || e.button !== 0) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        onNavigate()
      }}
    >
      {children}
    </a>
  )
}

/** Small read-only fact: a muted label and its value. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="fact">
      <span className="fact__k">{label}</span> <span className="fact__v">{value}</span>
    </li>
  )
}
