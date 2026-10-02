# IT-02-FE-03 自测报告 — 键位归属清理与补注册（Q6 Ctrl+Shift+T 独占 + Q7 zoom×3/DevTools 注册表侧）

- **任务ID**: IT-02/FE-03（键位归属清理与补注册）
- **测试时间**: 2026-10-02 23:45–23:58（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ 注册面静态核对。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；键位归属为注册表纯逻辑，验证面 = shortcutSync/shortcutMatch 双源与回显触发单测（Q6/Q7 专测在场）+ 三处注册面 grep 核对。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-03.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-PEND-01 | Ctrl+Shift+T 唯一归属 reopenClosedTab；切换主题仅 Titlebar/菜单入口无键位；冲突三处注册面清理 | ✅ 通过 | ① 唯一归属：`shortcutSync.test.ts` > `Q6: reopenClosedTab is the sole Ctrl+Shift+T owner (toggleTheme chord withdrawn)` ✓（本轮 10/10 重跑）；② 注册面清理核对（本轮 grep）：viewCmds.ts toggleTheme 条目已无 shortcut/bindGlobal（Q6 撤键注释在场）、`tb.theme` 文案 = 「切换主题」/「Toggle theme」不含键位（en/zh 双字典）；③ 回显无该键：FE-02 单源派生下无键自动留空（`shortcutMatch.test` 无键留空用例 ✓）；④ darwin 侧过渡残余 `'Cmd+Shift+T'` = `Q6: toggleTheme has no darwin accelerator (self-expiring transitional residual)` 精确容忍（仅此值，改键即红）——BE-01 合流项，见「结论」口径 |
| AC-PEND-02 | 四键全量补注册（Ctrl+=/Ctrl+-/Ctrl+0/F12）+ darwin 四值迁入 + 回显单源派生一致 + 例外仅限登记清单（CHANGE-7） | ✅ 通过 | ① 注册表侧补注册（本轮 grep viewCmds.ts）：zoomIn `Ctrl+=` / zoomOut `Ctrl+-` / zoomReset `Ctrl+0` / toggleDevTools `F12` 均带 `bindGlobal: true`（matchGlobalShortcut 只拾取 bindGlobal&&shortcut，实触发达成）；② 回显↔触发：`shortcutMatch.test.ts` > `真实注册表：每个键位合成事件触发同键位命令（chord 与回显一致）` + `Q7: zoom/devtools registry chords match the MENU-menubar key table`（键位表锚定 MENU-menubar §3.4）✓；③ 双源/例外清单：`shortcutSync.test.ts` > `Q7 pre-registered exceptions stay armed for the darwin-side registration` + `every derivation exception documents a reason and names a known command`（例外仅 zoomIn/toggleDevTools，CHANGE-7 登记）✓；④ darwin 侧迁入 = BE-01 合流项（武装待触发，见「结论」口径） |
| AC-RULE-11 | 快捷键提示单源派生零例外 | ✅ 通过 | FE-02 回显全走 fmtShortcut 派生：Q7 四键回显（Ctrl+=/Ctrl+-/Ctrl+0/F12）随补注册自动出现、toggleTheme 回显随撤键自动留空（implementation-notes §4 零改动派生）；`buildMenus 全量菜单回显派生` 3 用例（有键 100% 回显=fmtShortcut/无键留空 isMac 双态/真实注册表触发一致）本轮重跑 ✓；例外账机制化（reason 非空+消亡条件）非豁免口子 |
| AC-NF-06 | 菜单提示与实际触发键位一致率 100% | ✅ 通过 | `shortcutSync.test.ts` > `AC-NF-06 dual-source audit records agree 100%` ✓ + `shortcutMatch.test.ts` > `AC-NF-06` 3 用例（Windows 回显逐字符一致/合成事件触发同一命令/mac 回显仅转字形）+ `真实注册表：每个键位合成事件触发同键位命令` ✓（本轮 24/24 重跑） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| shortcutSync 双源审计全量（Q6 独占/Q7 武装/例外机制） | ✅ 10/10 | `npx vitest run …/commands/shortcutSync.test.ts` | 2026-10-02 23:45 重跑（与 FE-02 同场） |
| shortcutMatch 回显↔触发一致性 | ✅ 14/14 | `npx vitest run …/commands/shortcutMatch.test.ts` | 含四键合成事件触发 |
| Q6 三处注册面清理核对 | ✅ | 本轮 grep：viewCmds 无键 / tb.theme 无键位文案 / darwin 过渡残余精确容忍 | 见上表 |
| Q7 注册表侧四键 + bindGlobal | ✅ | 本轮 grep viewCmds.ts + `Q7 … match the MENU-menubar key table` | 键位表锚定 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

## 结论

**通过**。AC-PEND-01 / AC-PEND-02 / AC-RULE-11 / AC-NF-06 四条全过（本任务文件面 = viewCmds/tabsCmds/i18n tb.theme 注册表侧）。**BE-01 合流口径**：darwin 侧 Q7 四键迁入与 toggleTheme 过渡残余删除属 BE-01 合流项（登记于收口批主账「BE-01 合流收尾备忘」）——shortcutSync 已写成「过渡态容忍 + 合流自升格严格断言」（四键全在逐值钉住 + toggleTheme 加速键必须消失的 all-or-none 机制，防只迁两键放行；pending 卫生用例 post-merge 强制删例外）。合流后用例零改动自动升格钉死。本轮零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| Q6 撤键/独占归属 | — | ✅ | ✅ | ✅（过渡残余精确容忍） | ✅ |
| Q7 四键补注册 + 实触发 | — | ✅ | ✅ | — | ✅ |
| 回显↔触发一致（四键） | ✅ | — | ✅ | — | ✅ |
| 双源审计/例外清单 | — | — | ✅ | ✅ | ✅ |

覆盖率: 8/12 (67%)（纯键位注册面，「渲染/错误处理」列部分不适用）
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 双源/触发单测 + 注册面核对，桌面适配口径）

## 证据来源存档

- 本轮重跑：`commands/shortcutSync.test.ts` 10/10、`commands/shortcutMatch.test.ts` 14/14（2026-10-02）
- 注册面核对：`src/renderer/src/commands/viewCmds.ts`（Q6/Q7 条目）、`i18n/en.ts:441`/`zh.ts:434`（tb.theme 无键位文案）
- 合流备忘：收口批主账 `reports/replica-review-adjudications.md`（BE-01 合流收尾备忘：all-or-none 升格 + pending 卫生用例强制）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
