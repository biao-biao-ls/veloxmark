import type { OutlineItem } from '../outline/extract'
import { foldKey } from '../editor/livePreview/fold'
import { t } from '../i18n'

interface Props {
  items: OutlineItem[]
  activePos: number | null
  onSelect: (pos: number) => void
  /** P18: folded heading keys (`level:text`) — drives triangle direction. */
  foldedKeys?: ReadonlySet<string>
  /** P18: triangle click toggles fold only — must not move the cursor. */
  onToggleFold?: (pos: number, key: string) => void
}

export default function Outline({
  items,
  activePos,
  onSelect,
  foldedKeys,
  onToggleFold
}: Props): React.JSX.Element {
  if (items.length === 0) {
    return <div className="outline-empty">{t('outline.empty')}</div>
  }
  return (
    <nav className="outline">
      {items.map((item, i) => {
        const key = foldKey(item.level, item.text)
        const folded = foldedKeys?.has(key) === true
        return (
          <button
            key={`${item.pos}-${i}`}
            className={`outline-item outline-l${item.level}${activePos === item.pos ? ' outline-active' : ''}`}
            style={{ paddingLeft: 12 + (item.level - 1) * 14 }}
            onClick={() => onSelect(item.pos)}
            title={item.text}
          >
            {onToggleFold && (
              <span
                className={`outline-fold${folded ? ' is-folded' : ''}`}
                title={t('fold.toggle')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFold(item.pos, key)
                }}
              >
                ▸
              </span>
            )}
            {item.text}
          </button>
        )
      })}
    </nav>
  )
}
