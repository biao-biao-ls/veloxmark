# IT-02-FE-02 自测报告 — 快捷键回显单源派生与双源守护（fmtShortcut 派生固化 + shortcutSync.test）

- **任务ID**: IT-02/FE-02（快捷键回显单源派生与双源守护）
- **测试时间**: 2026-10-02 23:15–23:28（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；快捷键回显为纯派生逻辑，验证面 = shortcutSync 双源审计单测 + shortcutMatch 回显↔触发一致性单测。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-02.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-07 | 菜单项快捷键 100% 回显且逐键一致；无键右侧为空不占位 | ✅ 通过 | `shortcutMatch.test.ts` > `AC-FN-07 / AC-NF-06 — buildMenus 全量菜单回显派生` 3 用例：`有键 100% 回显且文本 = fmtShortcut(键位)；无键留空（isMac=false）` + 同名（isMac=true）+ `真实注册表：每个键位合成事件触发同键位命令（chord 与回显一致）` 本轮重跑 24/24 ✓；派生零硬编码 = menuLayout 侧 `shortcut ? fmtShortcut : undefined`（implementation-notes 扫描确认） |
| AC-RULE-11 | 快捷键提示单源派生零例外（键字面量唯一声明，回显经派生） | ✅ 通过 | ① 派生单源：`fmtShortcut` 派生固化（shortcutDisplay.ts，无第二份回显字面量）；② 例外清单机制化：`shortcutSync.test.ts` > `every derivation exception documents a reason and names a known command`（DERIVATION_EXCEPTIONS reason/accelerator 非空+id 已知）+ `non-pending derivation exceptions are all still registered in the table` + `pending exceptions must still hit a table entry, else the fixture is spent`——例外有账、有机制、有消亡条件，非豁免口子；③ 键位表锚定：`Q7: zoom/devtools registry chords match the MENU-menubar key table` ✓ |
| AC-NF-06 | 菜单提示文本与实际触发键位一致率 100% | ✅ 通过 | ① `shortcutSync.test.ts` > `AC-NF-06 dual-source audit records agree 100%`（Command.shortcut ↔ DARWIN_COMMAND_ACCELERATORS 双源审计）✓；② 回显↔触发逐键：`shortcutMatch.test.ts` > `AC-NF-06` 3 用例（Windows 回显=注册表拼写逐字符一致 / 合成键位事件触发同一命令 / mac 回显仅转修饰键字形）+ `真实注册表：每个键位合成事件触发同键位命令` ✓；③ Q6/Q7 裁决钉住：`Q6: reopenClosedTab is the sole Ctrl+Shift+T owner (toggleTheme chord withdrawn)` + `Q7: zoom/devtools registry chords match the MENU-menubar key table` ✓ |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| shortcutSync 双源审计全量（Q6/Q7/例外机制/内联格式键豁免） | ✅ 10/10 | `npx vitest run …/commands/shortcutSync.test.ts` | 2026-10-02 23:15 重跑 |
| shortcutMatch 回显↔触发一致性全量 | ✅ 14/14 | `npx vitest run …/commands/shortcutMatch.test.ts` | 含 buildMenus 全量派生（isMac 双态） |
| Q6 重键归属（Ctrl+Shift+T 唯一归属） | ✅ | `Q6: reopenClosedTab is the sole Ctrl+Shift+T owner` | toggleTheme 撤键；matcher 注册序命中 |
| Q7 例外预登记武装态 | ✅ | `Q7 pre-registered exceptions stay armed for the darwin-side registration` | zoomIn/toggleDevTools pending:true |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（在案备忘非缺陷：Q7 例外（zoomIn Ctrl+=↔Cmd+Plus、toggleDevTools F12↔Cmd+Alt+I）以 `pending:true` 预登记——BE-01 darwin 表迁入后正向互检自动生效、测试零改动；合流时须删 toggleTheme 过渡例外、zoomIn/toggleDevTools 翻正（既有 BE-01 合流收尾备忘登记）。mac 回显形态口径（⌘+/⌘⌥I 为 darwin 加速键显示形态非 fmtShortcut 输出）已记 doc-drift。）

## 结论

**通过**。AC-FN-07 / AC-RULE-11 / AC-NF-06 三条全过。本轮 shortcutSync 10/10 + shortcutMatch 14/14 全绿（含 AC-NF-06 双源审计 100% 一致与回显↔触发逐键一致），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 全量菜单回显派生（isMac 双态） | ✅ | — | ✅ | — | ✅ |
| 回显↔触发逐键一致（合成事件） | — | ✅ | ✅ | — | ✅ |
| 双源审计（shortcut ↔ accelerators） | — | — | ✅ | ✅（例外账机制） | ✅ |
| Q6/Q7 裁决钉住 | — | — | ✅ | — | ✅ |

覆盖率: 8/12 (67%)（纯派生/审计逻辑，「渲染/错误处理」列部分不适用）
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 派生/双源单测，桌面适配口径）

## 证据来源存档

- 本轮重跑：`commands/shortcutSync.test.ts` 10/10、`commands/shortcutMatch.test.ts` 14/14（2026-10-02）
- 口径记录：任务 implementation-notes §1（mac 回显形态）、doc-drift（FE-03 页面元素表 macOS 形态勘误）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
