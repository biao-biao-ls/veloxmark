import { Decoration, type WidgetType } from '@codemirror/view'
import type { PendingDeco } from './handlers-ctx'

/**
 * 块内「源码/预览双区」共用机制 (8B，10A 复用) —— P28 文本源码路线的预览半边：
 * 聚焦态下源码留在文档文本里直接编辑（面板行 class 拼 chrome），实时预览是
 * 挂在块末的 trailing block widget（本助手）。约定：
 *   - 预览 widget 必须 `eq` 到内容（tex/svg…）+ i18nEpoch，逐键重建仅内容变才换 DOM；
 *   - chip 绝对定位于面板首行右上（行 class `position: relative` + chip
 *     `position: absolute`）——零布局成本（UX-P28 F3 / 看板红线 10）；
 *   - 预览只占 widget 自身 box（gap 用 padding），进出编辑态不引入 margin 抖动。
 */
export function previewBelow(pos: number, widget: WidgetType): PendingDeco {
  return {
    from: pos,
    to: pos,
    // block widgets render between lines; side 1 keeps them after the source
    // block's last line even if another decoration shares the position.
    value: Decoration.widget({ widget, block: true, side: 1 })
  }
}
