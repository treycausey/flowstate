"use client"

import { useEffect, useMemo, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onStartTimer: (label: string, ms: number) => void
}

export default function InstructionsModal({ open, onClose, onStartTimer }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab' && dialogRef.current) {
        // Simple focus trap: cycle within dialog
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const activeEl = document.activeElement as HTMLElement | null
        if (!activeEl) return
        if (e.shiftKey && activeEl === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // Focus the close button on open for keyboard users
    closeBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // no internal timers to cleanup

  const overlayProps = useMemo(() => ({
    className: 'modal-overlay',
    onClick: (e: React.MouseEvent) => {
      // Click outside dialog closes
      if (e.target === e.currentTarget) onClose()
    },
  }), [onClose])

  if (!open) return null

  return (
    <div {...overlayProps}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-title"
        className="modal"
      >
        <div className="stack">
          <header className="cluster" style={{ justifyContent: 'space-between' }}>
            <h3 id="instructions-title" style={{ margin: 0 }}>Instructions</h3>
            <button
              ref={closeBtnRef}
              type="button"
              className="button button--ghost"
              onClick={onClose}
              aria-label="Close instructions"
            >
              Close
            </button>
          </header>

          <div style={{ fontSize: 'var(--step--1)' }}>
            <p><strong>pH:</strong> 3 drops, flip several times, read immediately.</p>
            <p><strong>Ammonia:</strong> 8 drops #1, 8 drops #2, shake 5 seconds, read in 5 minutes.</p>
            <p><strong>Nitrite:</strong> 5 drops, shake 5 seconds, read in 5 minutes.</p>
            <p><strong>Nitrate:</strong> 10 drops #1, flip several times, shake bottle #2 for 30 seconds, 10 drops #2, shake 1 minute, read in 5 minutes.</p>
          </div>

          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <div className="cluster">
              <button type="button" className="button button--ghost" onClick={() => onStartTimer('NH3 (5 minutes)', 5 * 60 * 1000)}>NH3 (5 minutes)</button>
              <button type="button" className="button button--ghost" onClick={() => onStartTimer('NO2 (5 minutes)', 5 * 60 * 1000)}>NO2 (5 minutes)</button>
              <button type="button" className="button button--ghost" onClick={() => onStartTimer('NO3 (30 seconds)', 30 * 1000)}>NO3 (30 seconds)</button>
              <button type="button" className="button button--ghost" onClick={() => onStartTimer('NO3 (1 minute)', 60 * 1000)}>NO3 (1 minute)</button>
              <button type="button" className="button button--ghost" onClick={() => onStartTimer('NO3 (5 minutes)', 5 * 60 * 1000)}>NO3 (5 minutes)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
