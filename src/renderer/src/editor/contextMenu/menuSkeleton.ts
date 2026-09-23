/**
 * Context-menu skeleton + assembly（2C 自 registry.ts 平移）。
 *
 * `buildContextMenu(view, hit)` assembles the shared skeleton (剪切/拷贝/粘贴 →
 * 复制为…▶ → 段落▶ → 格式▶ → 插入▶) plus block deltas. The menu itself is
 * stateless presentation — items carry ids + translated labels and the React
 * host (components/EditorContextMenu.tsx) renders what the store holds. Zero
 * business logic in the DOM.
 *
 * 非平移点（spec 2C）：`const rt = runtime` → `getCtxRuntime()`（runtime 私有
 * 随迁 ctxMenuStore，行为等价）；`sep` 提为导出供 opsTable 共用（单源，不进
 * barrel 公面）。
 */
import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { getCtxRuntime } from './ctxMenuStore'
import { blockDeltas } from './deltaRegistry'
import {
  markdownToPlainText,
  selectionOrDocMarkdown,
  setHeadingLevel
} from './transforms'
import type { BlockHit, CtxMenuItem, CtxRuntime } from './types'

// ---- skeleton ----------------------------------------------------------------

/** Separator item primitive — shared with opsTable (kept out of the barrel). */
export function sep(id: string): CtxMenuItem {
  return { id, label: '', separator: true }
}

function cmdItem(
  rt: CtxRuntime,
  id: string,
  labelKey: string,
  opts: Partial<CtxMenuItem> = {}
): CtxMenuItem {
  // P22-F3: unified disabled state — explicit opts win, else consult the
  // command catalog (buildCommands … isDisabled) through the runtime bridge.
  const disabled = opts.disabled ?? rt.isCommandDisabled?.(id) ?? false
  return {
    id,
    label: t(labelKey),
    run: () => rt.runCommand(id),
    ...opts,
    disabled
  }
}

function paragraphSubmenu(view: EditorView, hit: BlockHit, rt: CtxRuntime, locked: boolean): CtxMenuItem {
  const headingLevel = hit.kind === 'heading' ? hit.headingLevel : undefined
  return {
    id: 'paragraph',
    label: t('ctx.paragraphGroup'),
    submenu: [
      ...[1, 2, 3, 4, 5, 6].map((n) => ({
        id: `heading${n}`,
        label: t(`cmd.heading${n}`),
        checked: headingLevel === n,
        disabled: locked,
        run: () => {
          setHeadingLevel(view, n)
        }
      })),
      {
        id: 'paragraphPlain',
        label: t('cmd.paragraph'),
        checked: hit.kind === 'paragraph',
        disabled: locked,
        run: () => setHeadingLevel(view, 0)
      },
      sep('paragraph-sep'),
      cmdItem(rt, 'blockquote', 'cmd.blockquote', {
        checked: hit.kind === 'blockquote',
        disabled: locked
      }),
      cmdItem(rt, 'listUl', 'cmd.listUl', {
        checked: hit.kind === 'list-ul',
        disabled: locked
      }),
      cmdItem(rt, 'listOl', 'cmd.listOl', {
        checked: hit.kind === 'list-ol',
        disabled: locked
      }),
      cmdItem(rt, 'taskList', 'cmd.taskList', {
        checked: hit.kind === 'task-item',
        disabled: locked
      }),
      sep('paragraph-sep2'),
      cmdItem(rt, 'lift', 'cmd.lift', { disabled: locked })
    ]
  }
}

function formatSubmenu(rt: CtxRuntime, locked: boolean): CtxMenuItem {
  return {
    id: 'format',
    label: t('menu.format'),
    submenu: [
      // wave⑥-6 P23-F4: whole-document format lives with its inline siblings
      // (Edit menu + Shift+Alt+F already dispatch the same command).
      cmdItem(rt, 'formatDocument', 'cmd.formatDocument'),
      sep('format-doc-sep'),
      cmdItem(rt, 'bold', 'cmd.bold', { disabled: locked }),
      cmdItem(rt, 'italic', 'cmd.italic', { disabled: locked }),
      cmdItem(rt, 'inlineCode', 'cmd.inlineCode', { disabled: locked }),
      cmdItem(rt, 'code', 'cmd.code', { disabled: locked }),
      cmdItem(rt, 'strikethrough', 'cmd.strikethrough', { disabled: locked }),
      cmdItem(rt, 'highlight', 'cmd.highlight', { disabled: locked }),
      sep('format-sep'),
      cmdItem(rt, 'insertLink', 'cmd.insertLink', { disabled: locked }),
      cmdItem(rt, 'clearFormat', 'cmd.clearFormat', { disabled: locked })
    ]
  }
}

function insertSubmenu(rt: CtxRuntime): CtxMenuItem {
  return {
    id: 'insert',
    label: t('menu.insert'),
    submenu: [
      cmdItem(rt, 'insertMermaidDiagram', 'cmd.insertMermaidDiagram'),
      cmdItem(rt, 'insertCallout', 'cmd.insertCallout'),
      cmdItem(rt, 'insertTable', 'cmd.insertTable'),
      // P22-F3: convertToTable greys out without a selection (isDisabled).
      cmdItem(rt, 'convertToTable', 'cmd.convertToTable')
    ]
  }
}

function copyAsSubmenu(view: EditorView, rt: CtxRuntime, locked: boolean): CtxMenuItem {
  return {
    id: 'copyAs',
    label: t('ctx.copyAs'),
    disabled: locked,
    submenu: [
      {
        id: 'copyAsMarkdown',
        label: t('cmd.copyAsMarkdown'),
        run: () => {
          void rt.clipboardWrite(selectionOrDocMarkdown(view)).then(() => rt.toast(t('toast.copiedMarkdown')))
        }
      },
      cmdItem(rt, 'copyAsHtml', 'cmd.copyAsHtml'),
      {
        id: 'copyAsPlainText',
        label: t('cmd.copyAsPlainText'),
        run: () => {
          void rt
            .clipboardWrite(markdownToPlainText(selectionOrDocMarkdown(view)))
            .then(() => rt.toast(t('toast.copiedPlain')))
        }
      }
    ]
  }
}

function linkDelta(hit: BlockHit, rt: CtxRuntime): CtxMenuItem[] {
  return [
    {
      id: 'openLink',
      label: t('cmd.openLink'),
      disabled: !hit.href,
      run: () => {
        if (hit.href) rt.openLink(hit.href)
      }
    },
    {
      id: 'copyLinkAddress',
      label: t('cmd.copyLinkAddress'),
      disabled: !hit.href,
      run: () => {
        if (!hit.href) return
        void rt.clipboardWrite(hit.href).then(() => rt.toast(t('toast.copiedLink')))
      }
    },
    sep('link-sep')
  ]
}

/** Assemble skeleton + block deltas for `hit`. */
export function buildContextMenu(view: EditorView, hit: BlockHit): CtxMenuItem[] {
  const rt = getCtxRuntime()
  // e2e debug seam（kind/pos/deltaCount — probe 契约）
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __veloxCtxLastHit?: unknown }).__veloxCtxLastHit = {
      kind: hit.kind,
      pos: hit.pos,
      deltaCount: (blockDeltas.get(hit.kind) ?? []).length
    }
  }
  if (!rt) return []
  const sel = view.state.selection.main
  const selEmpty = sel.from === sel.to
  // task-checkbox: "mostly disabled" — the checkbox owns its own interaction.
  const locked = hit.kind === 'task-checkbox'
  const emptyish = hit.kind === 'empty'

  const items: CtxMenuItem[] = []
  for (const factory of blockDeltas.get(hit.kind) ?? []) {
    items.push(...factory(view, hit, rt))
  }
  if (hit.kind === 'link') items.unshift(...linkDelta(hit, rt))
  if (hit.kind === 'image' && hit.href) items.unshift(...linkDelta(hit, rt))

  items.push(
    {
      id: 'cut',
      label: t('cmd.cut'),
      disabled: selEmpty || locked || emptyish,
      run: () => rt.runCommand('cut')
    },
    {
      id: 'copy',
      label: t('cmd.copy'),
      disabled: selEmpty || emptyish,
      run: () => rt.runCommand('copy')
    },
    {
      id: 'paste',
      label: t('cmd.paste'),
      disabled: locked,
      run: () => rt.runCommand('paste')
    },
    sep('s-copy-as'),
    copyAsSubmenu(view, rt, locked),
    sep('s-paragraph'),
    paragraphSubmenu(view, hit, rt, locked),
    sep('s-format'),
    formatSubmenu(rt, locked),
    sep('s-insert'),
    insertSubmenu(rt)
  )
  return items
}
