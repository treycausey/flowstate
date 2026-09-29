import type { FieldHint as Hint } from '@/lib/hints'

/** Display-only warning under a metric field, derived from its current value. */
export default function FieldHint({ id, hint }: { id: string; hint: Hint | null }) {
  if (!hint) return null
  return (
    <span id={id} className={`field-hint field-hint--${hint.tone}`}>
      {hint.tone === 'caution' && (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M8 1.5 15 14H1L8 1.5Z" fill="currentColor" />
          <path
            d="M8 6v4M8 11.6v.4"
            stroke="var(--panel-solid)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
      {hint.text}
    </span>
  )
}
