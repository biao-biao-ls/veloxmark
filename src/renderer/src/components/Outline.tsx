import type { OutlineItem } from '../outline/extract'
import { t } from '../i18n'

interface Props {
  items: OutlineItem[]
  activePos: number | null
  onSelect: (pos: number) => void
}

export default function Outline({ items, activePos, onSelect }: Props): React.JSX.Element {
  if (items.length === 0) {
    return <div className="outline-empty">{t('outline.empty')}</div>
  }
  return (
    <nav className="outline">
      {items.map((item, i) => (
        <button
          key={`${item.pos}-${i}`}
          className={`outline-item outline-l${item.level}${activePos === item.pos ? ' outline-active' : ''}`}
          style={{ paddingLeft: 12 + (item.level - 1) * 14 }}
          onClick={() => onSelect(item.pos)}
          title={item.text}
        >
          {item.text}
        </button>
      ))}
    </nav>
  )
}
