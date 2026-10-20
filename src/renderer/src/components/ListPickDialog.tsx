import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import DialogTitleBar from './DialogTitleBar'

export interface PickItem {
  id: string
  labelKey: string
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
        <DialogTitleBar title={title} onClose={onClose} lights="close-only" />
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
