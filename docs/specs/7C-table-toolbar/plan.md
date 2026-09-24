# 7C 实施方案

## 技术决策与理由

- **浮条挂 outer、绝对定位在 wrap 上缘之上**（spec 布局归属节）：outer（表格自建 `.cm-md-block-gap`）加 `position: relative`（scoped class，不动共享 gap 规则），bar `bottom: calc(100% - var(--space-1))`——**否决 body 浮层**（免 scroll/resize 联动，随 widget 自然滚动）与 wrap 内定位（`overflow-x: auto` 裁剪，diag-P28 注释明言）。**否决扩容顶槽**（改 padding-top = 编辑进/出推挤正文，红线 10 直接违约）。**否决退役 col +/−**（`data-table-handle` 值族探针契约，红线 1）。
- **`editor/table/toolbar.ts` 新模块**（widget.ts 是 1142 行债务文件，新逻辑不堆入——`mountTableToolbar(host, { view, sourceFrom, model, row, col })` 装配 DOM + 事件；widget.toDOM 仅在 `editing` 时一行调用）。
- **⊞ = 7E 移交**：hover 块工具栏 items 恢复「复制」单钮；⊞ 调 `openGridPicker`（`gridPicker.ts` 语义原样：onPick 事件时读 active → `resizeTableOp`）。
- **对齐三键**（7.4）：`setAlignOp(m, col, 'left'|'center'|'right')` 经 `runTableOp`（userEvent `input.table.align`，与菜单项同源同 userEvent）；按下态 = build 时 `model.aligns[active.col]` 精确匹配（'' 全不按），class `is-pressed`（token 底面）。点击 = set 不 toggle（与菜单项一致，同源优先）。
- **⋮ = `openTableContextMenu(view, sourceFrom, row, col, x, y)`**（按钮 rect 定位；row/col 事件时 `getTableEdit`）：整份菜单同源复用（id/项/disabled/快捷键注释全部零漂移，AC4）。
- **🗑 = 共享 `confirmDeleteTable(view, span, rt)`**：从 `opsTable.ts` 的 `deleteTable` item 内联逻辑**提取导出**，菜单项与 🗑 共用（同 confirm 形状/同 toast `toast.tableDeleted`/同 `deleteTableRange`）。span 事件时 `resolveTableModel` 重解析。`rt` 由 `getCtxRuntime()` 取（table 模块既有反向调 UI seam）。
- **事件时重解析**（红线 4）：所有 onClick/mousedown 闭包只持 `view`/`sourceFrom`（hint），事件时 `getTableEdit(view.state).active` / `resolveTableModel(view, this.sourceFrom)`。
- **按钮事件卫生**：mousedown `preventDefault + stopPropagation`（防 outer 的 click-to-source「点空白回源码」把手，attachBlockToolbar 同款）；outer 的 mousedown closest 白名单补 `.cm-md-table-toolbar`（双保险）。
- **按钮皮肤**：复用 `.cm-md-table-handle-btn` 观感（22px 方钮、token 背景、hover 提亮）——不发明平行皮肤（红线 6）；glyph：`⊞` / `◧` `▣` `◨`（title = `ctx.alignLeft/Center/Right`）/ `⋮`（title = 新 key `table.moreTitle`）/ `🗑`（title = `ctx.deleteTable`）。
- **编辑态隐藏 hover 复制栏**：CSS `.cm-md-table-editing .cm-md-block-toolbar { display: none }`（AC9，防双栏同屏）。
- **destroy 无需特殊清理**：bar 是 widget DOM 一部分（outer 子节点），随实例重建/销毁（与整表 DOM 同生命周期，无 body 残留）。
- **e2e**：把手/值族/菜单 id/命令 id/`__velox*` 零触碰；新 class `cm-md-table-toolbar*` 为 add-only；不新增 `data-op`/`data-table-handle` 值（探针面不扩，未来探针与 ⑱ chrome 规范落地时再定）。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/table/toolbar.ts` | **新建**：`mountTableToolbar(host, opts)`——左组 ⊞+对齐三键（按下态）、右组 ⋮+🗑；事件全部事件时重解析 |
| `editor/contextMenu/opsTable.ts` | **提取导出** `confirmDeleteTable(view, span, rt)`；`deleteTable` item 改调用（行为不变） |
| `editor/table/widget.ts` | `editing` 时 `mountTableToolbar(outer, …)`；hover 栏 items 恢复复制单钮（⊞ 移交）；outer mousedown 白名单 + `.cm-md-table-toolbar`；outer 加定位 class |
| `styles/markdown.css` | `.cm-md-table-outer`（position: relative）+ `.cm-md-table-toolbar`（绝对浮条、左/右组、`is-pressed`）+ 编辑态隐藏 hover 栏规则 |
| `i18n/zh.ts` + `i18n/en.ts` | 各 +1 key（`table.moreTitle`：更多操作 / More actions） |

## 状态/契约归属

无新状态（无 StateField/无存储；按下态是 build 时投影，非持久状态）。e2e 契约 add-only。⊞/网格选择器、对齐 op、删除源码区删除均走既有分发层（`runTableOp`/`deleteTableRange`）。

## import 改动面

`toolbar` → `./commands`（openTableContextMenu/runTableOp）、`./ops`、`./resolve`、`./state`、`./gridPicker`、`../contextMenu/opsTable`（confirmDeleteTable）、`../contextMenu/registry`（getCtxRuntime）、`../../i18n`。`widget` → `./toolbar`。opsTable 的提取函数不新增 import 面（deleteTableRange/t 已有）。**环检查点**：opsTable 不 import `table/widget|toolbar`，registry 不反向入 table——`npx madge --circular --extensions ts,tsx` 守护。

## 任务拆分

1. `opsTable.ts` 提取 `confirmDeleteTable`（行为不变重构）[先行]
2. `toolbar.ts` + widget 接线（⊞ 移交 + 浮条挂载 + 外点白名单）[依赖 1]
3. CSS + i18n + 编辑态隐藏 hover 栏 [依赖 2]

## 验证方案

- `npm run typecheck && npm run test:unit`（i18n 对齐过；无新纯逻辑，无新单测）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 内零既有字面量改动（`data-table-handle` 值族 DOM 存续核对：grep `dataset.tableHandle` 不少于 5 值）
- 人工冒烟（对照 `table-focus.png`/`table-btn-4.png`）：
  1. 点单元格进编辑：表格上缘上方浮现浮条「⊞ ◧ ▣ ◨ …… ⋮ 🗑」；离开编辑即隐、无残留
  2. ⊞ 打开 7E 网格选择器（语义同移交前）；hover 栏只剩「复制」
  3. 对齐三键：点左/中/右 → 冒号行变、按下态跟随；与右键菜单对齐项效果一致
  4. ⋮ 弹出与单元格右键同款菜单（含 7A 移动项、7B 快捷键注释面）
  5. 🗑 → 确认框（同右键删除表格文案）→ 删除 + toast；取消则零改动
  6. 进/出编辑正文零位移；col +/−、row +/−、grip 全可点（浮条不遮挡）
  7. 深浅主题对照；浮条与前一块重叠仅 paint、不推文本

## 实现细化（2026-09-24 implement 时决策）

- **widget.toDOM 挂载点**：outer 组装完成后 `if (active) mountTableToolbar(outer, …)`（TS 收窄用 `active` 而非 `editing` 布尔——`row/col` 直接取 `active.row/col`，少一次断言）。outer className 改 `'cm-md-block-gap cm-md-table-outer'`（定位 scope 独立 class，共享 gap 规则零触碰）。
- **hover 栏 items 恢复复制单钮**：⊞ 整项删除（`openGridPicker` import 一并出 widget）；`resizeTableOp` import 保留（`tableTestHook.op.resizeTable` 仍在用）。
- **按钮事件卫生落地**：`btn()` 工厂统一 mousedown/click 双 `preventDefault + stopPropagation`；outer mousedown closest 白名单补 `.cm-md-table-toolbar`（双保险，防 group 间隙命中 outer）。
- **对齐按下态**：`is-pressed` = build 时 `model.aligns[col]` 精确匹配（'' 全不按）；样式复用 `.table-insert-cell.is-hover` 同款 accent 底面（不发明平行皮肤，红线 6）。
- **⋮ 定位**：`b.getBoundingClientRect()` 的 `rect.left / rect.bottom + 2`（按钮下缘锚点）；row/col 事件时 `getTableEdit(view.state).active` 回退 build 值。
- **🗑 runtime**：`getCtxRuntime()` 空守卫后传共享 `confirmDeleteTable`（与菜单 item 同函数，行为零漂移）。
- **CSS 几何**：`bottom: calc(100% - var(--space-1))`——bar 底缘落在 outer 顶缘下 4px（gap 上槽内），bar 本体向上伸展叠前一块（paint-only）；bar `pointer-events: none` + group `auto`（组间空隙点击穿透到 outer click-to-source）；`.is-pressed` 仅 accent 底面 + `opacity: 1`。
- **编辑态隐藏 hover 栏**：`.cm-md-table-wrap.cm-md-table-editing .cm-md-block-toolbar { display: none }`（AC9）。
- **i18n**：仅 `table.moreTitle`（zh '更多操作' / en 'More actions'）1 个新 key，对齐测试过。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓（31 files / 311 tests；i18n 对齐过；无新纯逻辑故无新单测）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles（224 files）
- e2e 缝核对 ✓：diff 零既有字面量改动（仅 CSS 注释提及 `data-table-handle` 字样）；`dataset.tableHandle` 5 值族（`row-insert`/`row-delete`/`col-insert-left`/`col-delete`/`col-grip`）全存续；菜单 item id / 命令 id / `__velox*` 零触碰
- 待运行时冒烟补签（验证方案 1–7）：① 浮条编辑态挂/撤 ② ⊞ 移交后语义一致 + hover 栏复制单钮 ③ 对齐三键按下态随冒号行 ④ ⋮ 与右键菜单同款 ⑤ 🗑 confirm/toast 同源 ⑥ 零位移 + 把手可点性 ⑦ 双主题 paint-only 重叠
