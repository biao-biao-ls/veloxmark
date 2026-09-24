# 7D spec — 表格右键菜单快捷键提示（7.6）

> 看板任务：⑨ 7.6（`docs/markdown-ux-optimization.md` P1），依赖 ②（7B 快捷键绑定，已收敛）。spec id 取空位 `7D`（看板预置名 `7F` 已被 7.7 占用）。小任务：填充既有 `CtxMenuItem.shortcut` 字段，渲染面已就绪。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/table-btn-4.png`：Typora 表格右键菜单右列显示快捷键提示（`Ctrl+Enter` 下方插入行、`Alt+↑↓←→` 移动行列），无快捷键项右列留空。

VeloxMark 现状：7B 已绑定同款快捷键（`structKeyBindings`：Ctrl-Enter / Alt-Arrows，文件头显式留了「⑨ shortcut hints read this source」契约）；菜单 DOM 契约 `.velox-ctx-shortcut` 已渲染 `item.shortcut ?? ''`；**但 opsTable 从未填充该字段**——快捷键对用户不可发现。**What**：表单结构项填 `shortcut`，经既有 `fmtShortcut` 显示（mac ⌘ 风格）。**Why**：绑定的存在感与可发现性；key 字面量保持单一真源（7B 文件头契约）。

## AC（可测试）

1. **有快捷键的项均显示提示**：`insertRowBelow`→`Ctrl+Enter`、`moveRowUp`→`Alt+↑`、`moveRowDown`→`Alt+↓`、`moveColLeft`→`Alt+←`、`moveColRight`→`Alt+→`（win 显示；对照 `table-btn-4.png` 观感）。
2. **无快捷键项不占位**：其余项（插入上/左右、删除行列、剪贴板、文档级动作）`shortcut` 保持 undefined——CSS 现状（label `flex:1` + shortcut `flex:0 0 auto`）即零占位（渲染面零改动）。
3. **mac ⌘ 风格**：走既有 `fmtShortcut`（`Ctrl+Enter`→`⌘Enter`、`Alt+↑`→`⌥↑`）。
4. **单一真源**（7B 文件头契约）：提示值从 `structKeyBindings` 同源表推导——CM key 字面量在 keymap.ts 只出现一次；opsTable 不得手抄 key 字面量。
5. **e2e 缝不破坏**：`data-op` id / `.velox-ctx-shortcut` DOM 契约 / 命令 id 零改动（只填既有字段）。

## Out of scope（明确不做）

- 其他块类型菜单（heading/list/…）的命令快捷键提示（走 `commands.ts` 的 `shortcut` 双源另立任务）。
- 主编辑器 backstop 绑定面（7B 已落）；Cell 内 Tab/Enter 等导航键不入菜单提示（Typora 同样不展示）。
- `fmtShortcut` 本体改造（arrow glyph 转换放 keymap 纯函数层）。

## 约束引用

1（e2e 缝）→ AC5：纯字段填充；4（stale）→ 不适用（无事件闭包）；5（i18n）→ 无新文案；6（皮肤）→ 无新皮肤。keymap.ts 纪律（零项目内 value import）→ glyph 转换纯函数留在 keymap，fmtShortcut 调用放 opsTable。
