# IT-01/FE-04 自测报告 — 表格工具栏与⋮/右键同源菜单

- 任务: FE-04 表格工具栏与⋮/右键同源菜单（五组分组/回显单源/禁用规则/键盘通道兜底）
- 日期: 2026-09-29
- 分支: feature-zhanghuanbiao
- 工作目录: D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer

## 1. 收敛验证

| 门禁 | 结果 |
|---|---|
| `npm run typecheck` | 0 errors（双 tsconfig） |
| `npm run test:unit` | 627 passed (53 files) — 含 opsTable.test.ts 21 项 |
| `npm run build` | 成功 (25s) |
| 19 data-op 冻结集契约测试 | 8/8 passed（contract.test.ts） |
| e2e 缝 | `data-op` id 面 = 19 项冻结集合，无增删改 |

## 2. 五组菜单矩阵（ui_03_table_menu.html 复刻）

| 组 | groupId | 项数 | items（含 data-op） | shortcut 回显 | 禁用规则 |
|---|---|---|---|---|---|
| 行操作 | rowOps | 5 | insertRowAbove, insertRowBelow, moveRowUp, moveRowDown, deleteRow | Ctrl+Shift+Enter, Ctrl+Enter, Alt+↑, Alt+↓, — | moveRowUp: row≤0; moveRowDown: row≥rows-1; deleteRow: !canDeleteRow |
| 列操作 | colOps | 5 | insertColLeft, insertColRight, moveColLeft, moveColRight, deleteCol | Ctrl+Shift+←, Ctrl+Shift+→, Alt+←, Alt+→, — | moveColLeft: col≤0; moveColRight: col≥cols-1; deleteCol: !canDeleteCol |
| 对齐 | align | 3 | alignLeft, alignCenter, alignRight | — | 无 |
| 单元格 | cell | 3 | cutCell, copyCell, pasteCell | — | 无 |
| 结构删除 | structDelete | 3 | copyTable, formatTableSource, deleteTable(danger) | — | 无（deleteTable 走 confirm 流） |

- 分组标题: `velox-ctx-group-label`，11px / letter-spacing 0.12em / uppercase / --fg-dim
- 危险组徽标: `velox-ctx-group-badge`（结构删除组，DANGER/危险组）
- 组间分隔线: 4 条 `velox-ctx-sep`
- maxHeight: 480px（ui_03_table_menu.html 设计稿限高，popup 基座 maxHeightCap 通道）

## 3. 浏览器验证结果

| 验证项 | 结果 | 截图 |
|---|---|---|
| 五组分组渲染 | 5 组 + 危险组徽标，顺序与设计稿一致 | IT-01-FE-04-menu-groups.png |
| shortcut 回显 | 8 项 struct 快捷键回显（STRUCT_KEYS 派生）+ 4 项 submenu ▸ | 同上 |
| 禁用规则（边界） | row=0,col=0 时 moveRowUp + moveColLeft 灰显 | IT-01-FE-04-disable-rules.png |
| 对齐 checked | col=1(center) 时 alignCenter ✓ | IT-01-FE-04-align-checked.png |
| maxHeight 480px | 面板 style.maxHeight = 480px | 同上 |
| Shift+F10 唤出 | 单元格激活态 Shift+F10 → 五组菜单 | IT-01-FE-04-shift-f10.png |
| 非表格上下文不劫持 | openTableMenuAtActive 返回 false 时 fall-through（AC-ERR-12） | 代码审查确认 |
| 实现图 | 全页静态状态 | IT-01-FE-04-impl.png |

## 4. 前置联调移交 4 收口项

| # | 收口项 | 状态 | 说明 |
|---|---|---|---|
| ① | ⋮/右键菜单 insertRowAbove/insertColLeft/insertColRight 补 shortcut 回显 | ✅ | structShortcut 从 STRUCT_KEYS 派生，cmKeyToDisplay → fmtShortcut |
| ② | 菜单路径 insert/delete 补 toast 回执 | ✅ | TABLE_OP_TOAST_KEYS 13 键（contract.ts 零依赖单源），runStructOp 统一 runOp+toast |
| ③ | 清理 opsTable.ts 底部 4 个 local 适配器 const | ✅ | 改 import ops.ts 单源适配器（insertRowAboveOp 等） |
| ④ | toast.rowDeleted {i:row+1} / colDeleted {j:col+1} 传参 | ✅ | toastReceipt 统一传 `{ i: row + 1, j: col + 1 }` |

## 5. 新增/修改文件

| 文件 | 变更 |
|---|---|
| `editor/contextMenu/opsTable.ts` | 全量重写：TABLE_MENU_GROUPS 五组、isTableOpDisabled、tableDeltaItems 五组渲染、runFor 19 op 映射 |
| `editor/contextMenu/opsTable.test.ts` | 新增 21 项单测（五组结构/shortcut 派生/禁用规则/toast key 完备性） |
| `editor/contextMenu/contract.ts` | 新增 TABLE_OP_TOAST_KEYS（13 键冻结映射） |
| `editor/contextMenu/types.ts` | CtxMenuItem.groupTitle、CtxMenuState.maxHeightCap |
| `editor/contextMenu/popup.ts` | PopupLayoutInput.maxHeightCap 限高上限通道 |
| `components/EditorContextMenu.tsx` | flatten 跳过 groupTitle、JSX 渲染分组标题 + 危险徽标、maxHeightCap 透传 |
| `editor/table/commands.ts` | toastTableOp 导出、move toast 接线、openTableMenuAtActive（Q8 键盘通道）、maxHeightCap: 480 |
| `editor/table/toolbar.ts` | align toast 接线 |
| `editor/table/keymap.ts` | NestedNavFns.openMenu、menuKeyBindings（Shift-F10/ContextMenu） |
| `editor/table/widget.ts` | tableNav.openMenu、tableMenuBindings 导出 |
| `editor/setup.ts` | tableMenuBindings 接入主编辑器 keymap |
| `editor/table/keymap.test.ts` | navSpy 补 openMenu 字段 |
| `i18n/en.ts` + `i18n/zh.ts` | menu.grp.* 6 键（5 组名 + dangerBadge） |
| `styles/context-menu.css` | .velox-ctx-group-label / .velox-ctx-group-badge |

## 6. 动态发现

- `implementation-notes`: popup 基座新增 `maxHeightCap` 可选参数（popup.ts），表格菜单传 480px 对齐 ui_03_table_menu.html 设计稿；其他弹层不受影响（不传则用视口公式）。
- `implementation-notes`: `NestedNavFns` 新增 `openMenu` 字段（keymap.ts），Q8 键盘通道经注入缝进入，保持 keymap.ts 零项目依赖纪律。
- `discovered-dependencies`: 无新增 npm 依赖。

## 7. AC 覆盖对照

| AC | 验证 |
|---|---|
| AC-FN-03/05/06/24 | 五组菜单/插入删除/结构删除/禁用规则 ✅ |
| AC-RULE-02/03/09/10 | 四面同源/回显/禁用/限高滚动+边缘翻转 ✅ |
| AC-OP-05/06/08 | toast 回执/参数/剪贴板静默 ✅ |
| AC-ERR-05/06/09 | 边界禁用/最小结构禁删/不劫持非表格 ✅ |
| UI-IXD-01/03/04 | 五组分组/快捷键回显/键盘遍历跳过 groupTitle ✅ |
| UI-ELEM-04 | 禁用态视觉（灰显 + cursor: default） ✅ |
