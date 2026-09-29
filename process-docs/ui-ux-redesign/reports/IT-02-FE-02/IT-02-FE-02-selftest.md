# IT-02-FE-02 自测报告 — 快捷键回显单源派生与双源守护

- 任务：`process-docs/ui-ux-redesign/tasks/IT-02/FE-02.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 结论：**阶段 1 开发验收 + 阶段 2 自测验收通过**（阶段 3 联调待 BE-01 / FE-03 落地后闭环）

## 1. 验收标准对照

| AC | 判据 | 结果 | 证据 |
|---|---|---|---|
| AC-FN-07① | 有快捷键命令 100% 右侧回显 | ✅ | `shortcutMatch.test.ts` buildMenus 全量断言（菜单面有键命令全量回显）+ 浏览器 View/编辑菜单实测 |
| AC-FN-07② | 提示文本与实际触发键位逐键一致 | ✅ | `shortcutMatch.test.ts` 合成键位事件 round-trip（回显 ↔ 触发同源）；Windows 回显 = 注册表拼写逐字符一致 |
| AC-FN-07③ | 无键命令右侧为空、无占位符 | ✅ | buildMenus 断言 `shortcut === undefined`（不渲染 span）；实测「复制为 HTML」「删除线」等右侧留空 |
| AC-RULE-11 | 快捷键提示单源派生、禁止手工双源维护 | ✅ | 回显唯一入口 `fmtShortcut`（menuLayout/opsTable/useMenus 全走派生）；`grep "Ctrl+"` menuLayout.ts + MenuBar.tsx 零命中；`shortcutSync.test` 双源守护 + DERIVATION_EXCEPTIONS 原因字段强制 |
| AC-NF-06 | 提示文本与实际触发键位一致率 100% | ✅ | §2/§3 比对记录全量一致；`shortcutSync.test` 双源审计记录 14/14 一致 |

## 2. AC-NF-06 比对记录 — 双源审计（registry ↔ DARWIN_COMMAND_ACCELERATORS）

记录形状（shortcutSync.test `auditRecords` 同口径）：`{ cmd, win, darwin, derived, exception }`，`derived = win.replaceAll('Ctrl+','Cmd+')`。

| cmd | win | darwin | derived | exception |
|---|---|---|---|---|
| newFile | Ctrl+N | Cmd+N | Cmd+N | null |
| openFile | Ctrl+O | Cmd+O | Cmd+O | null |
| openFolder | Ctrl+Shift+O | Cmd+Shift+O | Cmd+Shift+O | null |
| quickOpen | Ctrl+P | Cmd+P | Cmd+P | null |
| saveFile | Ctrl+S | Cmd+S | Cmd+S | null |
| saveFileAs | Ctrl+Shift+S | Cmd+Shift+S | Cmd+Shift+S | null |
| openPreferences | Ctrl+, | Cmd+, | Cmd+, | null |
| toggleTheme | Ctrl+Shift+T | Cmd+Shift+T | Cmd+Shift+T | null（FE-03 Q6 双侧撤除） |
| toggleFocusMode | F8 | F8 | F8 | null |
| toggleTypewriterMode | F9 | F9 | F9 | null |
| toggleSourceMode | Ctrl+/ | Cmd+/ | Cmd+/ | null |
| globalSearch | Ctrl+Shift+F | Cmd+Shift+F | Cmd+Shift+F | null |
| copyRichText | Ctrl+Shift+C | CmdOrCtrl+Shift+C | Cmd+Shift+C | P20 登记：macOS 双修饰键采用 CmdOrCtrl 惯例写法 |
| formatDocument | Shift+Alt+F | Shift+Alt+F | Shift+Alt+F | null |

**一致率 14/14 = 100%**（不一致且未登记例外 → 测试失败，守护不放宽）。

Q7 预登记例外（`pending: true`，BE-01 迁入 darwin 侧后正向互检自动生效，无需改测试）：

| cmd | win（FE-03 注册） | darwin（BE-01 迁入） | 例外原因 |
|---|---|---|---|
| zoomIn | Ctrl+= | Cmd+Plus | macOS 惯例把 =/+ 键写作 Plus（Cmd+Plus）；注册表保留 `Ctrl+=` |
| toggleDevTools | F12 | Cmd+Alt+I | macOS 开发者工具惯用 Cmd+Alt+I；Windows/Linux 注册表保留 `F12` |

zoomOut（Ctrl+- ↔ Cmd+-）、zoomReset（Ctrl+0 ↔ Cmd+0）派生直接一致，无需例外。

## 3. AC-NF-06 比对记录 — 菜单回显（fmtShortcut 单源派生）

浏览器实测（Windows 形态；`out/renderer` 构建 + 真实菜单 DOM 提取）：

| 菜单项 | 触发键位（Command.shortcut） | 回显文本 | 一致 |
|---|---|---|---|
| 撤销/重做 | Ctrl+Z / Ctrl+Y | Ctrl+Z / Ctrl+Y | ✅ |
| 剪切/复制/粘贴 | Ctrl+X / Ctrl+C / Ctrl+V | 同左 | ✅ |
| 复制为富文本 | Ctrl+Shift+C | Ctrl+Shift+C | ✅ |
| 复制为 HTML | 无 | 空（无占位符） | ✅ |
| 全选 / 查找 | Ctrl+A / Ctrl+F | 同左 | ✅ |
| 格式化文档 | Shift+Alt+F | Shift+Alt+F | ✅ |
| 加粗/斜体/行内代码 | Ctrl+B / Ctrl+I / Ctrl+E | 同左 | ✅ |
| 删除线/高亮 | 无 | 空 | ✅ |
| 导出选区为 HTML… | 无 | 空 | ✅ |
| 切换大纲 | 无 | 空 | ✅ |
| 文件夹内搜索… | Ctrl+Shift+F | Ctrl+Shift+F | ✅ |
| 折叠全部/展开全部 | 无 | 空 | ✅ |
| 专注/打字机/源码模式 | F8 / F9 / Ctrl+/ | 同左 | ✅ |
| 输入辅助 ×3 | 无 | 空 | ✅ |
| 放大/缩小/重置缩放/开发者工具 | 无（FE-03 Q7 补注册前） | 空（回显随注册自动出现） | ✅（现状口径） |
| 切换主题 | Ctrl+Shift+T（FE-03 Q6 撤键前） | Ctrl+Shift+T | ✅（现状口径） |

**菜单面一致率 100%**（0 条提示与注册键位不符）。上述每行 `回显 === fmtShortcut(shortcut)` 由 `shortcutMatch.test.ts` buildMenus 全量断言逐项钉住。

## 4. AC-NF-06 比对记录 — 表格结构操作（STRUCT_KEYS 同规则派生）

`editor/table/keymap.ts` `STRUCT_KEYS` → `cmKeyToDisplay` → `fmtShortcut`（与菜单同一派生入口，opsTable.ts）：

| 结构操作 | CM 键位 | 回显（浏览器实测） | 一致 |
|---|---|---|---|
| 在下方插入行 | Ctrl-Enter | Ctrl+Enter | ✅ |
| 上移该行 | Alt-ArrowUp | Alt+↑ | ✅ |
| 下移该行 | Alt-ArrowDown | Alt+↓ | ✅ |
| 左移该列 / 右移该列 | Alt-ArrowLeft/Right | Alt+← / Alt+→（`keymap.test.ts` 单测钉住） | ✅ |
| 在上方插入行 / 删除行 / 插删列 | 无 | 空 | ✅ |

## 5. 测试与质量门禁

| 项 | 命令 | 结果 |
|---|---|---|
| 双源守护 | `npx vitest run src/renderer/src/commands/shortcutSync.test.ts` | ✅ 6/6（含 DERIVATION_EXCEPTIONS 机制：非空 reason + 已知命令 id + 卫生检查 + Q7 预登记 + 反向钉住 + 审计记录） |
| 回显/触发一致 | `npx vitest run src/renderer/src/commands/` | ✅ 4 文件 34 测试（shortcutDisplay 5 + shortcutSync 6 + shortcutMatch 14 + menuLayout 9） |
| 全量单测 | `npm run test:unit` | ✅ 39 文件 400 测试 |
| 类型检查 | `npm run typecheck` | ✅ 0 Error（tsconfig.web + tsconfig.node） |
| 代码扫描 | `grep -n "Ctrl+" menuLayout.ts MenuBar.tsx` | ✅ 零命中（回显全走派生） |
| macOS 形态 | `shortcutDisplay.test.ts` | ✅ `Ctrl+N`→`⌘N`、`Ctrl+Shift+O`→`⌘⇧O`、`Shift+Alt+F`→`⇧⌥F`、`F12` 同形、空串安全 |

## 6. 浏览器验证

- 实现图：`IT-02-FE-02-impl.png`（展开「视图」菜单显示回显列，有键右对齐/无键留空）
- 附图：`IT-02-FE-02-impl-table.png`（「编辑」菜单回显列 + 表格结构面）
- 交互逐条：① 菜单展开回显核对（视图/编辑/格式子菜单/表格 ⋮）✅；② 双源守护测试执行 ✅（§5）；③ 一致率度量 ✅（§2–4）
- 平台口径：Windows/Linux 菜单回显 = `Ctrl+N` 拼写；macOS 走原生菜单加速键显示（自绘 MenuBar 在 `.platform-mac` 隐藏），`fmtShortcut` 的 ⌘/⇧/⌥ 转换有单测钉住

## 7. 待联动闭环（阶段 3）

1. **FE-03（Q6/Q7 注册表侧）**：zoomIn/zoomOut/zoomReset/toggleDevTools 补注册 + toggleTheme 撤键 + reopenClosedTab 独占 Ctrl+Shift+T 后，菜单回显自动同步（单源派生，无需改菜单代码）；`shortcutSync.test` 的 Q7 预登记例外届时自动生效。
2. **BE-01（darwin 加速键侧）**：zoom×3/DevTools 迁入 `DARWIN_COMMAND_ACCELERATORS` + toggleTheme entry 删除后，`shortcutSync.test` 正向互检仍绿（守护生效判据）。
3. **Q6 现状提示**：toggleTheme 与 reopenClosedTab 现同键 `Ctrl+Shift+T`，`matchGlobalShortcut` 按注册序取 tabs 域先命中（reopenClosedTab 行为正确）；echo↔trigger 一致性不受重键影响（重键归属是 Q6 清理项）。
