/**
 * 快捷键双源一致性守护（FE-02 固化基线）—— renderer `Command.shortcut` 与
 * `electron/shared/commandAccelerators.ts`（darwin 原生菜单加速键）不得漂移。
 *
 * 派生规则：shortcut 的 `Ctrl+` → `Cmd+`（Electron accelerator 在 macOS 上的
 * 惯例写法），其余段不动；写法差异必须登记在 DERIVATION_EXCEPTIONS 并注明
 * 原因（AC-RULE-11 双源守护不放宽，禁止静默例外）。
 *
 * 守护面（Q7 后 zoom×3/DevTools 补注册即自动纳入——正向互检按表逐条全量覆盖）：
 * - 正向：表中每个 entry 都必须与对应命令的 shortcut 派生一致（或命中例外）；
 * - 机制：每条例外必须带非空 reason + accelerator，且 id 为已知命令；
 * - 卫生：非 pending 例外必须仍在表中（防死条目）；pending 例外为 Q7 预登记
 *   （darwin 侧 BE-01 / 注册表侧 FE-03 落地前表中尚无对应 entry）；
 * - 反向钉住：bold/italic/inlineCode 故意无加速键（CM6 keymap 拥有 Mod-B/I/E，
 *   原生加速键会抢注）——防止有人"顺手补上"；其回显仍取注册表 shortcut。
 * - Q6/Q7 同步（FE-03）：Ctrl+Shift+T 唯一归属 reopenClosedTab（toggleTheme
 *   键位通道全撤并入反向钉住）；zoom×3/DevTools 补注册后纳入正向互检（zoomIn
 *   `Ctrl+=` ↔ `Cmd+Plus` 永久例外）。darwin 侧增删归 BE-01——合流前残留以
 *   过渡态容忍、BE-01 落地标记（Q7 四键任一在表，all-or-none）出现即自动升格
 *   严格断言（四键全在逐值钉住 + toggleTheme 加速键必须消失）。
 * - pending 例外卫生：残余容忍型 pending 必须仍命中表中条目，否则容忍对象
 *   消失——断言失效、例外条目可删；合流后不得再有 pending 残留（预登记翻正 /
 *   过渡条目删除是 BE-01 收尾动作）。
 * - 一致率（AC-NF-06）：逐命令输出比对记录
 *   `{ cmd, win, darwin, derived, exception }`，全部一致率 100%。
 */
import { describe, expect, it } from 'vitest'
import { DARWIN_COMMAND_ACCELERATORS } from '../../../../electron/shared/commandAccelerators'
import { stubCommandOps } from '../test-stubs/commandOps'
import { buildCommands } from './build'
import type { Command } from './types'

interface DerivationException {
  accelerator: string
  /** Why this id deviates from `Ctrl+`→`Cmd+` — mandatory, never silent. */
  reason: string
  /** Armed ahead of the darwin-side registration (BE-01/FE-03, Q7). */
  pending?: boolean
}

const DERIVATION_EXCEPTIONS: Record<string, DerivationException> = {
  copyRichText: {
    accelerator: 'CmdOrCtrl+Shift+C',
    reason: 'P20 registers CmdOrCtrl so the chord works on both modifiers in macOS'
  },
  // Q7 预登记（FE-02 登记写法差异；BE-01 把 darwin 键位迁入表后正向互检自动生效）：
  zoomIn: {
    accelerator: 'Cmd+Plus',
    reason: 'Q7 惯例写法差异: macOS spells the =/+ key as Plus (Cmd+Plus); registry keeps Ctrl+=',
    pending: true
  },
  toggleDevTools: {
    accelerator: 'Cmd+Alt+I',
    reason: 'Q7 惯例写法差异: macOS opens DevTools with Cmd+Alt+I; Windows/Linux registry keeps F12',
    pending: true
  },
  // Q6 过渡（FE-03 注册表侧撤键后、BE-01 删除 darwin entry 前）：darwin 表中残留
  // 预裁决键位 'Cmd+Shift+T'，仅容忍该精确残留。BE-01 合流后表中无 toggleTheme
  // entry，本条自动失效（可删），目标态由 NO_CHORD_BY_RULING 用例严格断言。
  toggleTheme: {
    accelerator: 'Cmd+Shift+T',
    reason: 'Q6 撤键后 darwin 侧残留预裁决键位待 BE-01 删除（过渡态，合流后本条失效）',
    pending: true
  }
}

/** Intentionally accelerator-free (CM6 keymap owns the chords in-editor). */
const NO_ACCELERATOR_BY_DESIGN = ['bold', 'italic', 'inlineCode']

/** Q6 裁决反向钉住：键位通道全撤（无 shortcut、无加速键），防"顺手补回"。 */
const NO_CHORD_BY_RULING = ['toggleTheme']

/**
 * BE-01 合流标记（Q7 键位表四键，all-or-none）：任一在表即算合流已启动，
 * 严格断言四键全在并逐值钉住 + toggleTheme 加速键必须消失——防「只迁两键 +
 * toggleTheme 残留」被全绿放行；四键全无才走过渡分支。
 */
const MERGE_MARKER_IDS = ['zoomIn', 'zoomOut', 'zoomReset', 'toggleDevTools'] as const

function be01MergeStarted(): boolean {
  return MERGE_MARKER_IDS.some((id) => DARWIN_COMMAND_ACCELERATORS[id] !== undefined)
}

/** AC-NF-06 比对记录形状（自测报告引用同一口径）。 */
interface DualSourceRecord {
  cmd: string
  win: string | undefined
  darwin: string
  derived: string
  exception: string | null
}

function derive(shortcut: string): string {
  return shortcut.replaceAll('Ctrl+', 'Cmd+')
}

/** 逐命令双源比对记录（AC-NF-06 度量输入）。 */
function auditRecords(byId: Map<string, Command>): DualSourceRecord[] {
  return Object.entries(DARWIN_COMMAND_ACCELERATORS).map(([id, darwin]) => {
    const cmd = byId.get(id)
    const win = cmd?.shortcut
    const exception = DERIVATION_EXCEPTIONS[id]
    return {
      cmd: id,
      win,
      darwin,
      derived: derive(win ?? ''),
      exception: exception ? exception.reason : null
    }
  })
}

describe('DARWIN_COMMAND_ACCELERATORS ↔ Command.shortcut', () => {
  const byId = new Map(buildCommands(stubCommandOps()).map((c) => [c.id, c]))

  it('every accelerator entry points at a known command and matches its shortcut', () => {
    for (const [id, accelerator] of Object.entries(DARWIN_COMMAND_ACCELERATORS)) {
      const cmd: Command | undefined = byId.get(id)
      expect(cmd, `accelerator id "${id}" has no command`).toBeDefined()
      if (!cmd) continue
      const exception = DERIVATION_EXCEPTIONS[id]
      const expected = exception ? exception.accelerator : derive(cmd.shortcut ?? '')
      expect(accelerator, `accelerator for "${id}" drifted from shortcut "${cmd.shortcut}"`).toBe(
        expected
      )
    }
  })

  it('every derivation exception documents a reason and names a known command', () => {
    for (const [id, entry] of Object.entries(DERIVATION_EXCEPTIONS)) {
      expect(entry.reason.trim(), `exception "${id}" must document a non-empty reason`).not.toBe('')
      expect(entry.accelerator.trim(), `exception "${id}" must document a non-empty accelerator`).not.toBe('')
      expect(byId.get(id), `exception "${id}" names an unknown command`).toBeDefined()
    }
  })

  it('non-pending derivation exceptions are all still registered in the table', () => {
    for (const [id, entry] of Object.entries(DERIVATION_EXCEPTIONS)) {
      if (entry.pending) continue
      expect(DARWIN_COMMAND_ACCELERATORS[id]).toBeDefined()
    }
  })

  it('pending exceptions must still hit a table entry, else the fixture is spent (delete it)', () => {
    // 卫生（Minor-2）：pending 例外的容忍对象必须真实存在——命中表中条目即活，
    // 否则「断言失效可删」（失败消息即提示）。合流前：残余容忍型（toggleTheme）
    // 须命中 darwin 表；预登记型（zoomIn/toggleDevTools，合流标记四键）空窗合法，
    // 由 all-or-none 用例接管。合流后：不得再有 pending 残留（预登记翻正式例外、
    // 过渡条目删除是 BE-01 收尾动作）。
    const pendingIds = Object.entries(DERIVATION_EXCEPTIONS)
      .filter(([, entry]) => entry.pending)
      .map(([id]) => id)
    if (be01MergeStarted()) {
      expect(
        pendingIds,
        'post-merge: no pending exception may remain — flip pre-registrations to formal, delete spent fixtures'
      ).toEqual([])
      return
    }
    for (const id of pendingIds) {
      if ((MERGE_MARKER_IDS as readonly string[]).includes(id)) continue
      expect(
        DARWIN_COMMAND_ACCELERATORS[id],
        `pending exception "${id}" hits no table entry — guard spent, delete the dead fixture`
      ).toBeDefined()
    }
  })

  it('Q7 pre-registered exceptions stay armed for the darwin-side registration', () => {
    // pending 例外的键对写死核对：BE-01 迁入后本用例改走正向互检，禁止漂移。
    expect(DERIVATION_EXCEPTIONS.zoomIn?.accelerator).toBe('Cmd+Plus')
    expect(DERIVATION_EXCEPTIONS.toggleDevTools?.accelerator).toBe('Cmd+Alt+I')
    for (const id of ['zoomIn', 'zoomOut', 'zoomReset', 'toggleDevTools']) {
      expect(byId.get(id), `Q7 command "${id}" missing from the registry`).toBeDefined()
    }
  })

  it('inline-format chords intentionally have no native accelerator', () => {
    for (const id of NO_ACCELERATOR_BY_DESIGN) {
      expect(
        DARWIN_COMMAND_ACCELERATORS[id],
        `"${id}" must not gain an accelerator (CM6 keymap owns Mod chords in-editor)`
      ).toBeUndefined()
      // 回显仍取注册表 shortcut（menu:echo-single-source 既有口径）。
      expect(byId.get(id)?.shortcut, `"${id}" must keep its registry shortcut for menu echo`).toBeTruthy()
    }
  })

  it('Q6: reopenClosedTab is the sole Ctrl+Shift+T owner (toggleTheme chord withdrawn)', () => {
    const owners = [...byId.values()]
      .filter((c) => c.shortcut === 'Ctrl+Shift+T')
      .map((c) => c.id)
    expect(owners, 'Ctrl+Shift+T must have exactly one owner').toEqual(['reopenClosedTab'])
    expect(byId.get('reopenClosedTab')?.bindGlobal, 'reopenClosedTab must trigger globally').toBe(true)
    for (const id of NO_CHORD_BY_RULING) {
      const cmd = byId.get(id)
      expect(cmd, `chord-free command "${id}" must stay registered (id/run unchanged)`).toBeDefined()
      expect(cmd?.shortcut, `"${id}" must not regain the chord (Q6 ruling)`).toBeUndefined()
    }
  })

  it('Q6: toggleTheme has no darwin accelerator (self-expiring transitional residual)', () => {
    const residual = DARWIN_COMMAND_ACCELERATORS.toggleTheme
    if (be01MergeStarted()) {
      // BE-01 已合流（四键任一在表即算启动，all-or-none）：目标态严格——无加速键。
      expect(residual, 'post-merge: toggleTheme accelerator must be deleted').toBeUndefined()
    } else {
      // 合流前过渡态：仅容忍预裁决原键位，任何改键都是漂移。
      expect(residual, 'pre-merge residual must be the exact pre-Q6 chord').toBe('Cmd+Shift+T')
    }
  })

  it('Q7: zoom/devtools registry chords match the MENU-menubar key table', () => {
    const q7: Record<string, string> = {
      zoomIn: 'Ctrl+=',
      zoomOut: 'Ctrl+-',
      zoomReset: 'Ctrl+0',
      toggleDevTools: 'F12'
    }
    for (const [id, shortcut] of Object.entries(q7)) {
      const cmd = byId.get(id)
      expect(cmd, `Q7 command "${id}" missing from the registry`).toBeDefined()
      expect(cmd?.shortcut, `Q7 chord for "${id}"`).toBe(shortcut)
      // matchGlobalShortcut 只拾取 bindGlobal 命令——不补全局绑定则按键不触发。
      expect(cmd?.bindGlobal, `Q7 chord "${id}" must trigger via global keydown`).toBe(true)
    }
    // darwin 侧（BE-01）：四键任一在表 → all-or-none 严格——断言四键全在、
    // 按 Q7 键位表逐值钉住 + toggleTheme 加速键必须消失（防半迁 + 残留全绿）。
    if (be01MergeStarted()) {
      for (const id of MERGE_MARKER_IDS) {
        expect(
          DARWIN_COMMAND_ACCELERATORS[id],
          `BE-01 partial merge: "${id}" missing — migration is all-or-none`
        ).toBeDefined()
      }
      expect(DARWIN_COMMAND_ACCELERATORS.zoomIn).toBe('Cmd+Plus')
      expect(DARWIN_COMMAND_ACCELERATORS.zoomOut).toBe('Cmd+-')
      expect(DARWIN_COMMAND_ACCELERATORS.zoomReset).toBe('Cmd+0')
      expect(DARWIN_COMMAND_ACCELERATORS.toggleDevTools).toBe('Cmd+Alt+I')
      expect(
        DARWIN_COMMAND_ACCELERATORS.toggleTheme,
        'post-merge: toggleTheme accelerator must be deleted'
      ).toBeUndefined()
    }
  })

  it('AC-NF-06 dual-source audit records agree 100%', () => {
    const records = auditRecords(byId)
    expect(records.length).toBe(Object.keys(DARWIN_COMMAND_ACCELERATORS).length)
    for (const rec of records) {
      const expected = rec.exception !== null ? DERIVATION_EXCEPTIONS[rec.cmd]?.accelerator : rec.derived
      expect(
        rec.darwin,
        `record ${JSON.stringify(rec)} disagrees (expected ${expected})`
      ).toBe(expected)
    }
    // 形状示例（save）：{ cmd, win, darwin, derived, exception: null }
    const save = records.find((r) => r.cmd === 'saveFile')
    expect(save).toEqual({
      cmd: 'saveFile',
      win: 'Ctrl+S',
      darwin: 'Cmd+S',
      derived: 'Cmd+S',
      exception: null
    })
  })
})
