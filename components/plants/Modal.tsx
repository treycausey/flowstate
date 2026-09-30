'use client'

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** Id of the element that titles the dialog. */
  labelledBy: string
  onClose: () => void
  children: ReactNode
  /** Selector of the element to focus on open; the first focusable one by default. */
  initialFocus?: string
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog in a portal (the frosted panel's backdrop-filter would otherwise trap
 * position: fixed). Escape closes, Tab stays inside, and focus returns to what opened it.
 * Mount it only while open.
 */
export default function Modal({ labelledBy, onClose, children, initialFocus }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  // Reads the latest onClose without re-running the open effect (which would steal focus)
  const requestClose = useEffectEvent(() => onClose())
  // Read while rendering, before any child (autofocus) can move focus into the dialog
  const [opener] = useState(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
  )

  useEffect(() => {
    const dialog = dialogRef.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!first || !last) return
      if (!active || !dialog.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const target =
      (initialFocus ? dialog?.querySelector<HTMLElement>(initialFocus) : null) ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [initialFocus, opener])

  return createPortal(
    <div
      className="modal-overlay"
      data-tank-ignore
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="modal plant-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
