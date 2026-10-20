import { Decoration, type WidgetType } from '@codemirror/view'
import type { PendingDeco } from './handlers-ctx'

export function previewBelow(pos: number, widget: WidgetType): PendingDeco {
  return {
    from: pos,
    to: pos,
    value: Decoration.widget({ widget, block: true, side: 1 })
  }
}
