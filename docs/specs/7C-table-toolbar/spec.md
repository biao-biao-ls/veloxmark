# 7C spec — 编辑态表格工具栏（三件套：⊞ / 对齐三键 / ⋮+🗑）

> 看板任务：⑥ 7.3（`docs/markdown-ux-optimization.md` P0），**一次落地三件套**——含 7.4（对齐三键）与 7.9（🗑 删除表格）。依赖 ⑤（7E）的 ⊞ 语义（本 spec 承接其「⑥ 落地时移交」）。spec id `7C-table-toolbar` 与批次号绑定。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/table-focus.png`：Typora 编辑态表格上方浮现统一工具栏——左「行列数 ⊞ + 左/中/右对齐三键」，右「⋮ 更多操作 + 🗑 删除」；离开编辑即隐。

VeloxMark 现状：无编辑态工具栏；+/− 把手散在左槽（行）/顶槽（列）+ 列宽 grip；hover 块工具栏仅「复制」+（7E 过渡的）⊞；对齐只能右键菜单（无状态回显）；删除表格只有右键菜单项。**What**：编辑态表格上方浮现统一工具栏（⊞ + 对齐三键 | ⋮ + 🗑），退出即隐。**Why**：把表格高频操作收拢到一个可发现的常驻入口，对齐补齐状态回显，删除给出直达按钮（保留确认框安全垫）。

## 布局归属（红线 10 / 几何约束的显式论证）

- 工具栏 = **outer（`.cm-md-block-gap` 表格自建外壳）内的绝对定位浮条**，位于 wrap 上缘之上（贴 handle 带上方）：不占 layout（进出编辑零推挤）、随 widget 滚动（非 body 浮层，免 scroll 联动）。
- **不进 wrap**：wrap `overflow-x: auto` 会裁剪溢出子元素（diag-P28 注释明言把手只能在 wrap padding 带内）。
- **不与把手抢槽**：col +/− 顶槽把手与 col-grip **全部保留**——`data-table-handle` 值族（`col-insert-left`/`col-delete`/`col-grip`/`row-insert`/`row-delete`）是探针硬契约（红线 1），退役/遮挡即盲改。工具栏在把手带**上方**叠放（Typora 同位），与 28px 带零重叠。
- 工具栏与前一块的重叠是 paint-only（编辑态短暂浮层），不移动任何文本——零布局抖动契约成立。⑮（7G）/⑱（chrome 规范）后续统一把手与 chrome 形态时再整体收口。

## AC（可测试）

1. **显隐**：仅表格局块编辑态（`spec.active != null`）挂载；退出编辑（选区离开/Escape/exitTableEdit）随 widget 重建自动撤除，无残留 DOM。
2. **左组**：⊞（7E 网格选择器**移交**至此；hover 块工具栏恢复「复制」单钮）+ 对齐三键。
3. **对齐三键**（含 7.4）：一键设置当前列（`getTableEdit.active.col`）对齐；与右键菜单对齐项**同源**（同 `setAlignOp`、同 `input.table.align`）；**按下态回显**与源码冒号行一致（build 时读 `model.aligns[col]`：'' 无按下，left/center/right 对应键按下）。
4. **⋮ 更多操作**：弹出与单元格右键**同一菜单**（`openTableContextMenu`，项/语义/id 全同源；锚点 = 按钮位置；row/col = 事件时 active 单元格）。
5. **🗑 删除**（含 7.9）：与右键「删除表格」**同 confirm/同 toast**（共享同一提取函数），保留确认框安全垫。
6. **布局抖动零回归**（红线 10）：进/出编辑正文零位移；工具栏不遮挡 col/row 把手与 grip（可点性保留，探针坐标命中面不减）。
7. **事件时重解析**（红线 4）：所有按钮回调事件时 `resolveTableModel`/`getTableEdit` 重解析；不捕获 toDOM 时刻的 cell 偏移/模型。⊞ pick → `resizeTableOp`（7E 语义原样）。
8. **e2e 缝不破坏**：`data-table-handle` 值族 DOM 与 id 全保留；既有 `data-op`/命令 id/`__velox*` 零改动；新 DOM class 为 add-only。
9. **hover 块工具栏不与本栏同屏双堆**：编辑态隐藏 hover 复制栏（CSS 层），非编辑态行为不变。

## Out of scope（明确不做）

- +/− 把手退役/改造（⑮ 7G 归口；本 spec 明确保留——缝契约）。
- 7.7 列宽持久化（⑫）、7.8 静息态 chrome（⑮）、7.10 视觉微调（⑯）、11.9 chrome 规范（⑱，收口时以本栏实际形态为输入）。
- 复制表格按钮本体（⋮ 菜单已有 copyTable；hover 栏「复制」保留——不重复设钮）。
- 新快捷键（7B 已落）。

## 约束引用（红线逐条对应）

1（e2e 缝）→ AC8：把手/值族零触碰，菜单 item id 不新增不改（⋮ 复用整份菜单）；3（Widget 纪律）→ 不新增 widget 类型（DOM 于 toDOM 装配，destroy 随实例走）；4（stale-instance）→ AC7；5（i18n）→ 新 key 同落 en/zh（见 plan，约 1 个）；6（按钮皮肤）→ 用既有 `.cm-md-table-handle-btn` 观感或 `.btn` 族，不发明平行皮肤；10（零布局抖动）→ AC6 布局归属节。
