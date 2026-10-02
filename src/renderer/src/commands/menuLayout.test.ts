/**
 * FE-01 菜单信息架构重排守护（menu:ia-reorder / menu:insert-dedupe / menu:rename-consistency）。
 *
 * 红线（AC-FN-09 / AC-RULE-17）：命令 id 集合与重排前基线完全一致——重排只动
 * MENU_LAYOUT 呈现层（分组/位次/命名），id 字面量一个都不改。
 * 目标结构真源：menu-tree §3（文件 5 组 / 编辑 5 组 / 视图 6 组 / 插入 2 组 / 帮助单项）。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { setLang } from '../i18n'
import { EN } from '../i18n/en'
import { ZH } from '../i18n/zh'
import { stubCommandOps } from '../test-stubs/commandOps'
import { buildCommands } from './build'
import { buildMenus, MENU_LAYOUT, type LayoutItem } from './menuLayout'
import type { Command } from './types'
import type { MenuItem } from '../components/MenuBar'

/** menu-tree §9 e2e 缝硬契约：48 个菜单栏命令 id（重排前基线，字面量不得漂移）。 */
const BASELINE_COMMAND_IDS = [
  'newFile', 'openFile', 'openFolder', 'quickOpen', 'saveFile', 'saveFileAs',
  'openPreferences', 'exportPdf', 'exportHtml', 'showHelp', 'undo', 'redo',
  'cut', 'copy', 'paste', 'copyRichText', 'copyAsHtml', 'selectAll', 'find',
  'formatDocument', 'bold', 'italic', 'inlineCode', 'strikethrough', 'highlight',
  'exportSelectionHtml', 'insertTable', 'convertToTable', 'toggleOutline',
  'globalSearch', 'foldAll', 'unfoldAll', 'toggleFocusMode', 'toggleTypewriterMode',
  'toggleSourceMode', 'toggleTypingAssists', 'toggleWrapBareUrlOnPaste',
  'togglePasteHtmlToMd', 'zoomIn', 'zoomOut', 'zoomReset', 'toggleDevTools',
  'toggleTheme', 'insertMermaidDiagram', 'insertCallout', 'nextTab', 'closeTab',
  'reopenClosedTab'
]

/** Stub registry: label = id so assertions read ids even through t() labels. */
function stubCommands(): Command[] {
  return BASELINE_COMMAND_IDS.map((id) => ({ id, label: id, run: () => {} }))
}

function collectIds(items: MenuItem[]): string[] {
  const out: string[] = []
  for (const item of items) {
    if (item.id) out.push(item.id)
    if (item.submenu) out.push(...collectIds(item.submenu))
  }
  return out
}

/** Layout special markers flatten to their tag name ('recent' | 'export' | 'format'). */
function normalizeItem(item: LayoutItem): string {
  return typeof item === 'string' ? item : Object.keys(item)[0]
}

function layoutSnapshot(): { menu: string; groups: { labelKey: string | null; items: string[] }[] }[] {
  return MENU_LAYOUT.map((menu) => ({
    menu: menu.menu,
    groups: menu.groups.map((group) => ({
      labelKey: group.labelKey ?? null,
      items: group.items.map(normalizeItem)
    }))
  }))
}

/** menu-tree §3 目标分组（组名 i18n key + 命令 id 位次）。 */
const TARGET_GROUPS = [
  {
    menu: 'file',
    groups: [
      { labelKey: 'menu.grp.newOpen', items: ['newFile', 'openFile', 'openFolder', 'quickOpen', 'recent'] },
      { labelKey: 'menu.grp.save', items: ['saveFile', 'saveFileAs'] },
      { labelKey: 'menu.grp.tabs', items: ['closeTab', 'reopenClosedTab', 'nextTab'] },
      { labelKey: 'menu.grp.export', items: ['export'] },
      { labelKey: 'menu.grp.settings', items: ['openPreferences'] }
    ]
  },
  {
    menu: 'edit',
    groups: [
      { labelKey: 'menu.grp.history', items: ['undo', 'redo'] },
      { labelKey: 'menu.grp.clipboard', items: ['cut', 'copy', 'paste', 'copyRichText', 'copyAsHtml', 'selectAll'] },
      { labelKey: 'menu.grp.findOrganize', items: ['find', 'formatDocument'] },
      { labelKey: 'menu.grp.format', items: ['format'] },
      { labelKey: 'menu.grp.selectionExport', items: ['exportSelectionHtml'] }
    ]
  },
  {
    menu: 'view',
    groups: [
      { labelKey: 'menu.grp.sidebarSearch', items: ['toggleOutline', 'globalSearch'] },
      { labelKey: 'menu.grp.fold', items: ['foldAll', 'unfoldAll'] },
      { labelKey: 'menu.grp.mode', items: ['toggleFocusMode', 'toggleTypewriterMode', 'toggleSourceMode'] },
      {
        labelKey: 'menu.grp.inputAssist',
        items: ['toggleTypingAssists', 'toggleWrapBareUrlOnPaste', 'togglePasteHtmlToMd']
      },
      { labelKey: 'menu.grp.zoom', items: ['zoomIn', 'zoomOut', 'zoomReset'] },
      { labelKey: 'menu.grp.devTheme', items: ['toggleDevTools', 'toggleTheme'] }
    ]
  },
  {
    menu: 'insert',
    groups: [
      { labelKey: 'menu.grp.table', items: ['insertTable', 'convertToTable'] },
      { labelKey: 'menu.grp.chartContainer', items: ['insertMermaidDiagram', 'insertCallout'] }
    ]
  },
  { menu: 'help', groups: [{ labelKey: null, items: ['showHelp'] }] }
]

// buildMenus 产出走 t()；钉住 en 断言文案（字典对齐由 i18n.test 守护）。
beforeAll(() => setLang('en'))

describe('menu:ia-reorder — MENU_LAYOUT 目标分组（menu-tree §3）', () => {
  it('五根菜单分组/位次与 menu-tree §3 完全一致', () => {
    expect(layoutSnapshot()).toEqual(TARGET_GROUPS)
  })
})

describe('AC-FN-09 — 命令 id 集合与重排前基线完全一致', () => {
  it('buildMenus 输出的命令 id 集合（含子菜单）与基线数组深比较一致', () => {
    const ids = buildMenus(stubCommands(), false).flatMap((menu) => collectIds(menu.items))
    expect(ids.slice().sort()).toEqual(BASELINE_COMMAND_IDS.slice().sort())
  })

  it('命令 id 无重复（insertTable 去重后全菜单唯一）', () => {
    const ids = buildMenus(stubCommands(), false).flatMap((menu) => collectIds(menu.items))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(BASELINE_COMMAND_IDS.length)
  })

  it('真实注册表交叉：BASELINE 全在真实注册表中，且 buildMenus(真实注册表) id 集 === BASELINE', () => {
    // stubCommands 由 BASELINE 自造——上面两条对「基线被就地改写」是自洽的，夹不住。
    // 这里走真实构建（buildCommands(stubCommandOps()) 产出生产注册表形状）交叉比对：
    // 1) 基线 id 必须真实存在于注册表（塞假 id 即红）；
    // 2) 真实注册表喂 buildMenus 的产出 id 集必须与基线逐 id 相等（基线被就地
    //    增删「迁就」布局漂移即红）。注册表另含右键菜单专用命令（不在菜单栏），
    //    故不做全集相等——菜单栏面以布局产出为准。
    const real = buildCommands(stubCommandOps())
    const realIds = new Set(real.map((c) => c.id))
    for (const id of BASELINE_COMMAND_IDS) {
      expect(realIds.has(id), `baseline id "${id}" missing from the real registry`).toBe(true)
    }
    const menuIds = buildMenus(real, false)
      .flatMap((menu) => collectIds(menu.items))
      .slice()
      .sort()
    expect(menuIds).toEqual(BASELINE_COMMAND_IDS.slice().sort())
  })
})

describe('menu:insert-dedupe — 插入域去重', () => {
  it('insertTable 全布局只出现一份，且在插入菜单；编辑菜单无插入类命令', () => {
    const flat = MENU_LAYOUT.flatMap((menu) =>
      menu.groups.flatMap((group) => group.items.map((item) => [menu.menu, normalizeItem(item)] as const))
    )
    const insertTableEntries = flat.filter(([, id]) => id === 'insertTable')
    expect(insertTableEntries).toEqual([['insert', 'insertTable']])

    const editIds = flat.filter(([menu]) => menu === 'edit').map(([, id]) => id)
    expect(editIds).not.toContain('insertTable')
    expect(editIds).not.toContain('convertToTable')

    const insertIds = flat.filter(([menu]) => menu === 'insert').map(([, id]) => id)
    expect(insertIds).toEqual(['insertTable', 'convertToTable', 'insertMermaidDiagram', 'insertCallout'])
  })
})

describe('menu:rename-consistency — globalSearch 命名统一（id 不变）', () => {
  it("cmd.globalSearch 文案为「文件夹内搜索…」/「Search in Folder…」", () => {
    expect(ZH['cmd.globalSearch']).toBe('文件夹内搜索…')
    expect(EN['cmd.globalSearch']).toBe('Search in Folder…')
  })

  it('globalSearch 命令 id 仍在视图菜单侧栏与搜索组', () => {
    const view = layoutSnapshot().find((menu) => menu.menu === 'view')
    expect(view?.groups[0]).toEqual({
      labelKey: 'menu.grp.sidebarSearch',
      items: ['toggleOutline', 'globalSearch']
    })
  })
})

describe('buildMenus — 分组标题呈现', () => {
  it('每组渲染一次不可点分组标题，组间仅一条分隔线', () => {
    const file = buildMenus(stubCommands(), false)[0]
    const groupTitles = file.items.filter((item) => item.groupTitle !== undefined)
    expect(groupTitles.map((item) => item.groupTitle)).toEqual([
      EN['menu.grp.newOpen'],
      EN['menu.grp.save'],
      EN['menu.grp.tabs'],
      EN['menu.grp.export'],
      EN['menu.grp.settings']
    ])
    // 标题项不可点：无 action
    for (const title of groupTitles) expect(title.action).toBeUndefined()
    // 组间分隔线 = 组数 - 1（不再按旧平铺口径切碎）
    expect(file.items.filter((item) => item.separator).length).toBe(file.items.filter((i) => i.groupTitle).length - 1)
  })

  it('帮助单项菜单无分组标题（不过度设计）', () => {
    const help = buildMenus(stubCommands(), false).find((menu) => menu.label === EN['menu.help'])
    expect(help?.items.filter((item) => item.groupTitle !== undefined)).toEqual([])
    expect(help?.items.filter((item) => item.separator)).toEqual([])
    expect(collectIds(help?.items ?? [])).toEqual(['showHelp'])
  })

  it('FE-01#2: 仅文件菜单 wide（is-wide 292px 面板）', () => {
    const menus = buildMenus(stubCommands(), false)
    expect(menus.find((menu) => menu.id === 'file')?.wide).toBe(true)
    for (const menu of menus.filter((m) => m.id !== 'file')) expect(menu.wide).toBeFalsy()
  })
})

describe('AC-FN-28 — 新分组名 i18n 双字典对齐', () => {
  it('menu.grp.* key 在 en/zh 双字典齐全且无裸 key 文案', () => {
    const groupKeys = [...new Set(layoutSnapshot().flatMap((m) => m.groups.map((g) => g.labelKey)))].filter(
      (key): key is string => key !== null
    )
    expect(groupKeys.length).toBe(18)
    for (const key of groupKeys) {
      expect(EN[key], `missing EN ${key}`).toBeTruthy()
      expect(ZH[key], `missing ZH ${key}`).toBeTruthy()
      // 裸 key 防护：字典值不得等于 key 本身
      expect(EN[key]).not.toBe(key)
      expect(ZH[key]).not.toBe(key)
    }
  })
})
