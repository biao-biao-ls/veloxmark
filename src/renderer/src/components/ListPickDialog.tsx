import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'

/**
 * P16: keyboard-first single-choice list dialog (Mermaid template picker).
 * Self-drawn on the P02 dialog CSS like ExportDialog; reused later by
 * P21 (callout types) and P22 (table sizes). ↑↓ move, Enter picks, Esc closes.
 */
export interface PickItem {
  id: string
  /** i18n key resolved at render time (language switches re-render App). */
  labelKey: string
  /** Optional secondary line (raw text, not i18n'd). */
  hint?: string
}

interface Props {
  open: boolean
  title: string
  items: PickItem[]
  onPick: (id: string) => void
  onClose: () => void
}

export default function ListPickDialog({
  open,
  title,
  items,
  onPick,
  onClose
}: Props): React.JSX.Element | null {
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open) {
      setIndex(0)
      // Focus the list so arrow keys work without an extra click.
      listRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[index]
      if (item) onPick(item.id)
    }
  }

  return (
    <div className="dialog-overlay list-pick-overlay" onKeyDown={onKeyDown} onMouseDown={onClose}>
      <div
        className="dialog list-pick-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">{title}</div>
        <div className="list-pick-list" ref={listRef} tabIndex={0}>
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`list-pick-item${i === index ? ' is-active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onPick(item.id)}
            >
              <span className="list-pick-label">{t(item.labelKey)}</span>
              {item.hint ? <span className="list-pick-hint">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
