## 代码审查报告 — IT-01/FE-04 表格工具栏与⋮/右键同源菜单

**得分：** 98/100（阈值：90）
**状态：** ✅ 通过
**基线规范：** code-review/SKILL.md + rubric-code-review.md（已 Read）；后端专项不适用（前端项目）
**评审范围：** `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`（opsTable/toolbar/EditorContextMenu/table commands/keymap/contract/keyboardNav/context-menu.css/i18n/测试）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码风格**（最高）：`chrome.css:308-314` MenuBar `.menu-item-shortcut` = 11px/--fg-dim/无 mono 字族；`MenuBar.tsx:534` 子菜单箭头「▸」；纯逻辑模块配同目录 `*.test.ts`；toast 经 `getCtxRuntime()?.toast` + `undoAction` seam；stale-instance 事件时重解析。
- **CLAUDE.md**：`t('ns.key')` 双字典同加（有 i18n.test 守护）；CSS token 化（`--fg-disabled`/`--fg-dim`/`--danger`）；单测纯函数不渲 widget；e2e 契约（data-op 19 字面量）冻结。
- **归因结论**：新代码与已有代码/CLAUDE.md 一致；客观项（安全/性能/测试/正确性）单独核查。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能全部实现（五组19项/回显/禁用/键盘兜底/四面同源） | 10 | 10 | | |
| 遗漏需求点 | 8 | 8 | | |
| 范围外多做（openActiveIndex+MenuBar 同改） | 8 | 8 | r2 定性批登记的同口径修正，带单测，非滥加 | |
| 需求理解正确性 | 7 | 7 | | |
| 边界/异常覆盖（1×1 禁删/空剪贴板静默/正文 fall-through/model null fail-safe） | 7 | 7 | | |
| 职责分离 | 10 | 10 | | |
| 错误处理（runOp 失败不 toast/confirm cancel 零副作用） | 10 | 10 | | |
| 项目风格一致 | 8 | 8 | | |
| 测试覆盖 | 8 | 8 | opsTable.test/menuSkeleton.test/keyboardNav.test/frozenCopy.test/i18n.test 均实读 | |
| 安全 | 8 | 8 | 无 innerHTML/XSS 面，clipboard 走 window.api | |
| 性能 | 8 | 8 | 装饰级无增负，菜单构建一次重解析 | |
| DRY | 2 | 4 | toast 键映射三处重复（-2） | 客观（维护性） |
| YAGNI | 4 | 4 | | |
| **合计** | **98** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Minor | toast 键映射双份，违背「四面同源收口」单源意图 | `INSERT_TOAST_KEYS`（insert 4 键）与 `STRUCTURE_TOASTS`（deleteRow/deleteCol）同值复制了 `TABLE_OP_TOAST_KEYS` 条目；contract.ts 自述该表为 AC-RULE-09 收口单源，改键需三处同步（动态 key 不被 i18n.test 的 unresolved 扫描捕获，漂移会让一面 toast 打出失效 key） | `src/renderer/src/editor/table/commands.ts:229-235,242-247`；`src/renderer/src/editor/table/contract.ts:64-78` | 删本地两表，`toastStructCmd`/`runTableOp` 直接消费 `TABLE_OP_TOAST_KEYS[cmd as TableMenuOpId]`（StructCmd 是 TableMenuOpId 子集），deleteRow/deleteCol 走同一映射 |
| Minor | 键盘就近落点偏离 cycleNavIndex 语义 | hover 可把 `activeIdx` 停在 disabled 项（`onHover` 未过滤 `disabled`），随后 ↑/↓ 因 `posIdx===-1` 落首/末项而非「就近可落点」（`cycleNavIndex` 文档语义）；键盘不可达禁用项本身不受影响（`enabled` 过滤保住 AC） | `src/renderer/src/components/EditorContextMenu.tsx:273-285,372-375` | `onHover` 对 `item.disabled` 不 `setActiveIdx`，或 onKeyDown 直接改用 `cycleNavIndex` 统一两处语义 |
| Info | kbd 回显 11px/无 mono 字族，任务元素表与 ui_03 `.menu-item .kbd` 标 12px mono | `.velox-ctx-shortcut` 11px 与 MenuBar `.menu-item-shortcut`（11px）一致——按「已有代码优先」归因不扣分 | `src/renderer/src/styles/context-menu.css:91-95`；对照 `chrome.css:308-314`、`docs/requirements/ui-ux-redesign/ui/ui_03_table_menu.html:504-511` | 若决定贴设计稿，MenuBar+ctxMenu 两处同步改 12px + mono 字族，并在 change-log 登记取舍；维持现状亦可（双面一致） |
| Info | 「▸」字形 | 与 MenuBar 同字形同槽位（shortcut span 内子菜单箭头），全仓一致 | `src/renderer/src/components/EditorContextMenu.tsx:92`；`MenuBar.tsx:534` | 无需处理 |
| Info | en 组名/徽标较 zh 简写 | en `Row/Column/Align/Cell/Structure/DANGER` vs zh `行操作/列操作/对齐/单元格/结构删除/危险组`，语义略缩 | `src/renderer/src/i18n/en.ts:124-129` | 可选：`Row Ops/Structure Delete` 等贴近 zh 冻结语义 |

### 结论

✅ **98 ≥ 90 通过**。四面同源主干（五组 19 项冻结 id、STRUCT_KEYS 单源回显派生、FE-01 禁用判定同源、Shift+F10/Menu 键盘兜底、限高 480+边缘翻转、冻结 toast 含 undo 按钮）经独立读码核实成立，i18n 双字典 key 全对齐且有测试守护，「▸」/字号与既有菜单面同型。仅 2 项 Minor（toast 键映射 DRY、hover+方向键就近落点）建议修复但不阻塞；无 Critical/Important。附注：本 reviewer 物理只读，`npm run typecheck/test:unit` 未代跑，测试项以实读测试文件内容为据。
